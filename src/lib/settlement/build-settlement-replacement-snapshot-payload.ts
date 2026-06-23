import {
  buildSettlementSnapshotPayload,
  type BuildSettlementSnapshotPayloadErrorCode,
  type BuildSettlementSnapshotPayloadInput,
  type SettlementSnapshotInsertPayload,
  type SettlementSnapshotJson
} from "@/lib/settlement/build-settlement-snapshot-payload";

export type SettlementReplacementSnapshotJson = SettlementSnapshotJson & {
  lifecycleStatus: "pending_replacement";
  replacementOfSnapshotId: string;
};

export type SettlementReplacementSnapshotInsertPayload = Omit<
  SettlementSnapshotInsertPayload,
  "snapshot"
> & {
  lifecycle_status: "pending_replacement";
  replacement_of_snapshot_id: string;
  superseded_by_snapshot_id: null;
  superseded_at: null;
  status_updated_at: null;
  status_updated_by: null;
  snapshot: SettlementReplacementSnapshotJson;
};

export type BuildSettlementReplacementSnapshotPayloadInput =
  BuildSettlementSnapshotPayloadInput & {
    replacementOfSnapshotId: string;
  };

export type BuildSettlementReplacementSnapshotPayloadErrorCode =
  | BuildSettlementSnapshotPayloadErrorCode
  | "missing_replacement_snapshot";

export type BuildSettlementReplacementSnapshotPayloadResult =
  | {
      ok: true;
      payload: SettlementReplacementSnapshotInsertPayload;
    }
  | {
      ok: false;
      errorCode: BuildSettlementReplacementSnapshotPayloadErrorCode;
    };

export function buildSettlementReplacementSnapshotPayload({
  replacementOfSnapshotId,
  ...input
}: BuildSettlementReplacementSnapshotPayloadInput): BuildSettlementReplacementSnapshotPayloadResult {
  if (!replacementOfSnapshotId.trim()) {
    return {
      ok: false,
      errorCode: "missing_replacement_snapshot"
    };
  }

  const built = buildSettlementSnapshotPayload(input);

  if (!built.ok) {
    return built;
  }

  return {
    ok: true,
    payload: {
      ...built.payload,
      lifecycle_status: "pending_replacement",
      replacement_of_snapshot_id: replacementOfSnapshotId,
      superseded_by_snapshot_id: null,
      superseded_at: null,
      status_updated_at: null,
      status_updated_by: null,
      snapshot: {
        ...built.payload.snapshot,
        lifecycleStatus: "pending_replacement",
        replacementOfSnapshotId
      }
    }
  };
}
