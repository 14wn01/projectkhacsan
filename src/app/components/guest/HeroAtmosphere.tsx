import { useEffect, useRef } from "react";

/** Photo-based 2.5D atmosphere, NOT a mesh reconstruction of the hotel.
 * One fullscreen quad; two locally hosted textures; adaptive 24fps; no library.
 * Water displacement is restricted to the pool in source-image coordinates.
 */
export default function HeroAtmosphere({ night, onUnavailable }: { night: boolean; onUnavailable: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const target = useRef(night ? 1 : 0);
  useEffect(() => { target.current = night ? 1 : 0; }, [night]);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
    if (!gl) { onUnavailable(); return; }
    let disposed = false, frame = 0, visible = true, last = 0, phase = 0, mix = target.current;
    let x = 0, y = 0, wantedX = 0, wantedY = 0;
    const shaders: WebGLShader[] = [], textures: WebGLTexture[] = [];
    const program = gl.createProgram(), buffer = gl.createBuffer();
    const vertex = `attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}`;
    const fragment = `precision mediump float;varying vec2 v;uniform sampler2D day;uniform sampler2D night;uniform float blend;uniform float time;uniform vec2 cover;uniform vec2 pointer;
    void main(){
      vec2 uv=(v-.5)*cover+.5;
      float foreground=1.-smoothstep(.02,.48,uv.y);
      uv+=pointer*(.003+foreground*.004);
      float pool=(1.-smoothstep(.26,.38,uv.y))*smoothstep(.12,.3,uv.x)*(1.-smoothstep(.8,.96,uv.x));
      float wave=sin(uv.y*170.+time*.8)*sin(uv.x*28.+time*.4);
      uv.x+=wave*.0007*pool;uv.y+=sin(uv.x*55.+time*.55)*.0004*pool;
      vec3 c=mix(texture2D(day,uv).rgb,texture2D(night,uv).rgb,blend);
      c+=vec3(.7,.53,.27)*pow(max(0.,wave),8.)*pool*.025;
      gl_FragColor=vec4(c,1.);
    }`;
    try {
      if (!program || !buffer) throw Error("GPU unavailable");
      for (const [kind, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
        const shader = gl.createShader(kind); if (!shader) throw Error("GPU unavailable");
        shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error("Shader unsupported");
        gl.attachShader(program, shader);
      }
      gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error("Shader unsupported");
    } catch {
      shaders.forEach(s => gl.deleteShader(s)); gl.deleteProgram(program); gl.deleteBuffer(buffer);
      gl.getExtension("WEBGL_lose_context")?.loseContext(); onUnavailable(); return;
    }
    gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program!, "a"); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const cover = gl.getUniformLocation(program!, "cover"), pointer = gl.getUniformLocation(program!, "pointer"), time = gl.getUniformLocation(program!, "time"), blend = gl.getUniformLocation(program!, "blend");
    let loaded = 0;
    const images = [new Image(), new Image()];
    const sourceAspect = 2200 / 1228;
    function resize() {
      const rect = canvas!.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.25);
      canvas!.width = Math.max(1, Math.round(rect.width * dpr)); canvas!.height = Math.max(1, Math.round(rect.height * dpr));
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      const aspect = rect.width / Math.max(1, rect.height);
      // 1.035 overscan keeps the edges covered during pointer parallax.
      gl!.uniform2f(cover, Math.min(1, aspect / sourceAspect) / 1.035, Math.min(1, sourceAspect / aspect) / 1.035);
    }
    function draw(now: number) {
      frame = 0; if (disposed || !visible || document.hidden || loaded < 2) return;
      if (now - last >= 1000 / 24) {
        const dt = Math.min((now - last) / 1000, .08); last = now; phase += dt;
        x += (wantedX-x)*.07; y += (wantedY-y)*.07; mix += (target.current-mix)*.08;
        gl!.uniform2f(pointer, x, y); gl!.uniform1f(time, phase); gl!.uniform1f(blend, mix);
        gl!.drawArrays(gl!.TRIANGLES, 0, 6);
        canvas!.style.opacity = "1";
      }
      frame = requestAnimationFrame(draw);
    }
    const wake = () => { if (!disposed && !frame && visible && !document.hidden && loaded === 2) { last = performance.now(); frame = requestAnimationFrame(draw); } };
    images.forEach((image, i) => {
      image.onload = () => {
        if (disposed) return;
        const texture = gl.createTexture(); if (!texture) { onUnavailable(); return; }
        textures.push(texture); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.uniform1i(gl.getUniformLocation(program!, i ? "night" : "day"), i); loaded++; wake();
      };
      image.onerror = () => { if (!disposed) onUnavailable(); };
      image.src = i ? "/media/hero-night.webp" : "/media/hero-sunset.webp";
    });
    const host = canvas.closest("section")!;
    const move = (event: PointerEvent) => { if (event.pointerType !== "mouse") return; const r = host.getBoundingClientRect(); wantedX = (event.clientX-r.left)/r.width-.5; wantedY = .5-(event.clientY-r.top)/r.height; };
    const leave = () => { wantedX=0; wantedY=0; };
    const lost = (event: Event) => { event.preventDefault(); onUnavailable(); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); else { cancelAnimationFrame(frame); frame=0; } }); observer.observe(host);
    const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
    host.addEventListener("pointermove", move, { passive: true }); host.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", wake); canvas.addEventListener("webglcontextlost", lost);
    return () => {
      disposed=true; cancelAnimationFrame(frame); observer.disconnect(); ro.disconnect();
      host.removeEventListener("pointermove", move); host.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", wake); canvas.removeEventListener("webglcontextlost", lost);
      images.forEach(image => { image.onload=null; image.onerror=null; });
      textures.forEach(t=>gl.deleteTexture(t)); shaders.forEach(s=>gl.deleteShader(s)); gl.deleteBuffer(buffer); gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [onUnavailable]);
  return <canvas className="cinema-atmosphere" ref={ref} aria-hidden="true" />;
}
