import { Clock, MapPin } from "lucide-react";
import { parkingHours, parkingPlace } from "@/lib/service-requests";
import { T } from "./t";

/** Where and when: parking only at the Nong Yai yard, in and out during business hours. */
export function ParkingInfo({ mapUrl, hours }: { mapUrl?: string; hours?: string }) {
  return (
    <div className="space-y-2 rounded-lg bg-sign-wash p-4 text-[15px]">
      <p className="flex items-start gap-2">
        <MapPin className="mt-0.5 size-5 shrink-0 text-grass" aria-hidden />
        <span>
          <strong className="text-ink"><T th={parkingPlace.th} en={parkingPlace.en} /></strong>
          {mapUrl && (
            <a href={mapUrl} target="_blank" rel="noreferrer" className="ml-2 font-semibold text-grass underline">
              <T th="เปิด Google Maps" en="Open Google Maps" />
            </a>
          )}
          <span className="block text-[13px] text-reflect"><T th={parkingPlace.noteTh} en={parkingPlace.noteEn} /></span>
        </span>
      </p>
      <p className="flex items-start gap-2">
        <Clock className="mt-0.5 size-5 shrink-0 text-grass" aria-hidden />
        <span>
          <strong className="text-ink"><T th={parkingHours.th} en={parkingHours.en} /></strong>
          {hours && (
            <span className="block text-[14px] text-ink-2">
              <T th={`เวลาทำการลานหนองใหญ่: ${hours}`} en={`Nong Yai yard hours: ${hours}`} />
            </span>
          )}
        </span>
      </p>
    </div>
  );
}
