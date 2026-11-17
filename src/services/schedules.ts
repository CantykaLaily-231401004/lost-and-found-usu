import { callRpc } from "./rpc";
import {
  mySchedulesFromRpc,
  wibToTimestamp,
  type MySchedulesData,
  type MySchedulesRaw,
} from "./mappers";

export const MAX_PICKUP_NOTE = 500;
export const MIN_CANCEL_REASON = 3;
export const MAX_CANCEL_REASON = 1000;

export async function getMySchedules(): Promise<MySchedulesData> {
  const raw = await callRpc<MySchedulesRaw>("rpc_get_my_schedules");
  return mySchedulesFromRpc(raw);
}

export async function requestSchedule(
  claimId: string,
  localValue: string,
  note: string,
) {
  const [date, time] = localValue.split("T");
  return callRpc<{ schedule_id: string; status: string; duplikat: boolean }>(
    "rpc_request_schedule",
    {
      p_claim_id: claimId,
      p_waktu: wibToTimestamp(date, time),
      p_catatan: note.trim() || null,
    },
  );
}

export async function cancelSchedule(scheduleId: string, reason: string) {
  return callRpc<{ schedule_id: string; status: string }>(
    "rpc_cancel_schedule",
    { p_schedule_id: scheduleId, p_alasan: reason.trim() },
  );
}

export async function confirmPickup(scheduleId: string) {
  return callRpc<{ schedule_id: string; selesai: boolean; duplikat: boolean }>(
    "rpc_confirm_pickup",
    { p_schedule_id: scheduleId },
  );
}