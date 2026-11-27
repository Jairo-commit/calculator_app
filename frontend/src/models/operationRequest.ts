import type { KeyId } from "./key";
import type { OperationCall } from "./operationCall";

export interface OperationRequest {
  call: OperationCall;
  triggerKey: KeyId;
}
