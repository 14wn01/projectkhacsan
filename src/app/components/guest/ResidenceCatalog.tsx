import { useMemo } from "react";
import { useStore } from "../../lib/store";
import { STAY_ORDER } from "./stay";
import { StayCollection } from "./StayCollection";

export function ResidenceCatalog({
  onDetail,
  showPrice = true,
}: {
  checkIn: string;
  checkOut: string;
  guests: number;
  sunset?: unknown;
  onDetail: (typeId: string) => void;
  showPrice?: boolean;
}) {
  const { roomTypes } = useStore();

  const collection = useMemo(() => {
    const rank = new Map(STAY_ORDER.map((id, i) => [id, i]));
    return [...roomTypes].sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99));
  }, [roomTypes]);

  return <StayCollection types={collection} onOpen={onDetail} showPrice={showPrice} />;
}
