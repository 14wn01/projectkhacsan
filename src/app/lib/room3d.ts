/** Lightweight WebGL architectural study; not a surveyed model. No remote assets. */
export type RoomStyle = 'standard'|'deluxe'|'suite'|'family'|'penthouse'|'presidential';
export function roomStyle(name:string):RoomStyle {
 if(/presiden|tổng thống|sao mai residence/i.test(name))return 'presidential';
 if(/penthouse|áp mái|sky residence/i.test(name))return 'penthouse';
 if(/family|gia đình/i.test(name))return 'family';
 if(/ocean suite|deluxe/i.test(name))return 'deluxe';
 if(/horizon suite|suite/i.test(name))return 'suite';
 if(/garden|pavilion|standard/i.test(name))return 'standard';
 return 'standard';
}
type V=[number,number,number];
const dot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(a:V):V=>{const l=Math.hypot(...a)||1;return [a[0]/l,a[1]/l,a[2]/l]};
export function buildRoomGeometry(style:RoomStyle){
 const large=['suite','penthouse','presidential'].includes(style),family=style==='family';
 const width=large?7.4:family?6.8:style==='deluxe'?5.7:5.2,depth=large?6.3:5.6;
 const data:number[]=[];
 function box(x:number,y:number,z:number,w:number,h:number,d:number,hex:number,mat=0){
 const color=[(hex>>16&255)/255,(hex>>8&255)/255,(hex&255)/255];
 const pts:V[]=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
 const faces:[number[],V][]=[[[4,5,6,7],[0,0,1]],[[1,0,3,2],[0,0,-1]],[[0,4,7,3],[-1,0,0]],[[5,1,2,6],[1,0,0]],[[3,7,6,2],[0,1,0]],[[0,1,5,4],[0,-1,0]]];
 for(const [ids,n] of faces)for(const i of [0,1,2,0,2,3]){const p=pts[ids[i]];data.push(x+p[0]*w/2,y+p[1]*h/2,z+p[2]*d/2,...n,...color,mat);}
 }
 const wood=0x76563e,ivory=0xe7ddc9,navy=0x30474a,gold=0xb39762;
 box(0,-.16,0,width+.16,.28,depth+.16,0x443b32);
 box(0,0,0,width,.05,depth,0xa3815e,1);
 box(0,1.35,-depth/2,width,2.7,.12,ivory);
 box(-width/2,1.35,0,.12,2.7,depth,0xd3c6ae);
 box(0,.12,-depth/2+.1,width,.16,.06,wood);
 const bx=large?-1.35:0;
 for(let i=0;i<25;i++)box(bx-1.56+i*.13,1.2,-depth/2+.1,.055,2.3,.06,wood,1);
 box(bx,2.5,-depth/2+.15,3.4,.025,.06,gold,4);
 // window and linen curtains
 box(-width/2+.08,1.6,.2,.04,1.8,2.8,0x7b9c9a,3);
 for(const z of [-1.23,.2,1.63])box(-width/2+.12,1.6,z,.07,1.86,.035,wood);
 for(const y of [.65,2.55])box(-width/2+.12,y,.2,.08,.06,3,wood);
 for(const z of [-1.48,1.65])for(let i=0;i<7;i++)box(-width/2+.22+(i%2)*.035,1.4,z+i*.055,.09,2.45,.058,0xe6d9c1,5);
 box(-width/2+.32,.64,.2,.5,.07,2.86,0xe5e1d6,2);
 box(bx,.055,.04,family?5.5:3.7,.035,3.9,0xbaa987,5);
 box(bx,.077,.04,family?5.25:3.45,.013,3.64,0xd6c8ad,5);
 function bed(x:number,w:number){
 box(x,.3,-.55,w,.44,2.32,wood,1);box(x,.61,-.55,w-.04,.26,2.22,0xf4ecdf,5);
 box(x,.91,-depth/2+.34,w+.08,1.18,.18,0x8c806b,5);
 box(x,.77,-.15,w-.05,.1,1.45,0xf7eedf,5);box(x,.84,.54,w,.045,.54,navy,5);
 for(const dx of [-.43,.43]){box(x+dx,.82,-1.23,.73,.17,.48,0xfaf4e8,5);box(x+dx,.93,-1,.44,.22,.14,0xb99d6b,5);}
 }
 if(family){bed(-1.4,1.76);bed(1.4,1.76)}else bed(bx,2.08);
 for(const x of family?[-2.67,2.67]:[bx-1.52,bx+1.52]){
 box(x,.34,-1.45,.56,.55,.6,wood,1);box(x,.65,-1.45,.6,.07,.64,0xe5e0d4,2);
 box(x,.38,-1.135,.22,.023,.025,gold,4);box(x,.93,-1.45,.025,.51,.025,gold,4);
 box(x,1.23,-1.45,.35,.29,.35,0xf1e1bc,5);
 }
 box(bx,.36,1.35,1.65,.15,.53,navy,5);
 for(const x of [bx-.7,bx+.7])for(const z of [1.18,1.51])box(x,.17,z,.035,.3,.035,gold,4);
 if(large){
 box(2.3,.35,-.3,1.32,.43,2.18,0xa99b81,5);box(2.86,.77,-.3,.2,.65,2.18,0x988a71,5);
 for(const z of [-1.3,.7])box(2.3,.64,z,1.32,.5,.18,0x988a71,5);
 for(const z of [-.9,-.3,.3])box(2.26,.62,z,1.02,.1,.54,0xd8cbb2,5);
 box(1.23,.46,.4,.8,.07,.85,0xe5e0d6,2);box(1.23,.23,.4,.42,.42,.45,gold,4);
 box(2,1.7,-depth/2+.12,1.6,.88,.065,gold,4);box(2,1.7,-depth/2+.17,1.48,.76,.025,navy);box(2,1.54,-depth/2+.19,1.48,.13,.02,0xa39677);
 }else{
 const x=width/2-.65;box(x,.87,1.85,1.05,.09,.6,wood,1);
 for(const dx of [-.43,.43])box(x+dx,.43,1.85,.035,.83,.48,gold,4);
 box(x,.44,1.03,.45,.12,.45,navy,5);for(const dx of [-.18,.18])box(x+dx,.21,1.03,.025,.4,.36,gold,4);
 box(x,.94,1.85,.31,.025,.23,0xd6c8ad);
 }
 if(style==='penthouse'||style==='presidential'){
 box(2.1,.44,2.45,2.2,.83,.5,wood,1);box(2.1,.91,2.45,2.28,.09,.56,0xe6e0d4,2);
 box(2.55,1.1,2.45,.18,.31,.18,0x6e8079);
 }
 return {vertices:new Float32Array(data),width,depth};
}
const VS=`attribute vec3 aPosition;attribute vec3 aNormal;attribute vec3 aColor;attribute float aMaterial;
uniform mat4 uView;uniform mat4 uProjection;varying vec3 p;varying vec3 n;varying vec3 c;varying float m;
void main(){p=aPosition;n=aNormal;c=aColor;m=aMaterial;gl_Position=uProjection*uView*vec4(p,1.0);}`;
const FS=`precision mediump float;varying vec3 p;varying vec3 n;varying vec3 c;varying float m;uniform vec3 uEye;
void main(){vec3 color=c;
if(m>.5&&m<1.5){float grain=sin(p.x*87.0+sin(p.z*6.0)*2.0)*.02+sin(p.x*18.0+p.z)*.04;float plank=step(.975,fract(p.x*2.3));color*=.97+grain-plank*.16;}
if(m>1.5&&m<2.5){float vein=pow(.5+.5*sin(p.x*9.0+p.z*4.0+sin(p.z*5.0)*1.8),18.0);color=mix(color,vec3(.4),vein*.3);}
if(m>2.5&&m<3.5){color=mix(vec3(.3,.49,.51),vec3(.78,.87,.83),clamp(p.y/2.8,0.0,1.0));color+=pow(max(0.0,sin(p.z*2.0+p.y*1.8)),16.0)*.1;}
if(m>4.5)color*=.97+.03*sin(p.x*140.0)*sin(p.z*140.0);
vec3 normal=normalize(n),light=normalize(vec3(-.6,1.0,1.2));
color*=.62+max(dot(normal,light),0.0)*.38+max(dot(normal,normalize(vec3(1.0,.4,-1.0))),0.0)*.1;
float spec=pow(max(dot(normal,normalize(light+normalize(uEye-p))),0.0),40.0);
color+=vec3(1.0,.9,.73)*spec*(m>1.5&&m<4.5?.24:.03);
color*=.87+.13*smoothstep(0.0,1.0,p.y);gl_FragColor=vec4(color,1.0);}`;
export interface RoomRenderer{orbit(dx:number,dy:number):void;zoom(delta:number):void;reset():void;resize():void;dispose():void}
export function createRoomRenderer(canvas:HTMLCanvasElement,style:RoomStyle,onLost:()=>void):RoomRenderer{
 const gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'low-power'});if(!gl)throw Error('WebGL unavailable');
 const shaders:WebGLShader[]=[];let program:WebGLProgram|null=null,buffer:WebGLBuffer|null=null;
 try{
 program=gl.createProgram();if(!program)throw Error('GPU allocation');
 for(const [type,source] of [[gl.VERTEX_SHADER,VS],[gl.FRAGMENT_SHADER,FS]] as const){const s=gl.createShader(type);if(!s)throw Error('GPU allocation');shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('GPU shader');gl.attachShader(program,s)}
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('GPU link');
 buffer=gl.createBuffer();if(!buffer)throw Error('GPU allocation');
 }catch(e){shaders.forEach(s=>gl.deleteShader(s));if(program)gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();throw e}
 const {vertices,width,depth}=buildRoomGeometry(style);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
 let offset=0;for(const [name,size] of [['aPosition',3],['aNormal',3],['aColor',3],['aMaterial',1]] as const){const loc=gl.getAttribLocation(program,name);if(loc>=0){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,40,offset*4)}offset+=size}
 const uv=gl.getUniformLocation(program,'uView'),up=gl.getUniformLocation(program,'uProjection'),ue=gl.getUniformLocation(program,'uEye');
 const base=Math.max(width,depth)*1.9;let theta=.55,phi=.78,distance=base,disposed=false,frame=0;
 function draw(){frame=0;if(disposed||document.hidden)return;
 const eye:V=[Math.sin(theta)*Math.cos(phi)*distance,Math.sin(phi)*distance+.65,Math.cos(theta)*Math.cos(phi)*distance];
 const z=unit([eye[0],eye[1]-.6,eye[2]]),x=unit(cross([0,1,0],z)),y=cross(z,x);
 gl!.uniformMatrix4fv(uv,false,new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]));
 const f=1/Math.tan(.65/2),aspect=canvas.width/Math.max(canvas.height,1),near=.1,far=100;
 gl!.uniformMatrix4fv(up,false,new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]));
 gl!.uniform3fv(ue,eye);gl!.viewport(0,0,canvas.width,canvas.height);gl!.clearColor(.91,.89,.85,1);gl!.clear(gl!.COLOR_BUFFER_BIT|gl!.DEPTH_BUFFER_BIT);gl!.enable(gl!.DEPTH_TEST);gl!.drawArrays(gl!.TRIANGLES,0,vertices.length/10);
 }
 const invalidate=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(draw)};
 const resize=()=>{const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.5);canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));invalidate()};
 const lost=(event:Event)=>{event.preventDefault();onLost()};
 canvas.addEventListener('webglcontextlost',lost);document.addEventListener('visibilitychange',invalidate);resize();
 return {orbit(dx,dy){theta+=dx;phi=Math.max(.22,Math.min(1.42,phi+dy));invalidate()},zoom(delta){distance=Math.max(base*.38,Math.min(base*1.6,distance*Math.exp(delta)));invalidate()},reset(){theta=.55;phi=.78;distance=base;invalidate()},resize,dispose(){disposed=true;cancelAnimationFrame(frame);canvas.removeEventListener('webglcontextlost',lost);document.removeEventListener('visibilitychange',invalidate);gl.deleteBuffer(buffer);gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s));gl.getExtension('WEBGL_lose_context')?.loseContext()}};
}
