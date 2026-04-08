import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export class ExternalBlob {
    getBytes(): Promise<Uint8Array<ArrayBuffer>>;
    getDirectURL(): string;
    static fromURL(url: string): ExternalBlob;
    static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob;
    withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob;
}
export interface http_header {
    value: string;
    name: string;
}
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface EmergencyContact {
    name: string;
    phone: string;
}
export interface AccidentRecord {
    id: string;
    status: string;
    videoUrl: string;
    location: string;
}
export interface UserProfile {
    userName: string;
    videoEvidence?: ExternalBlob;
    phoneNumber: string;
}
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addEmergencyContact(contact: EmergencyContact): Promise<void>;
    removeEmergencyContact(phone: string): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    getAllAccidents(): Promise<Array<[Principal, Array<AccidentRecord>]>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getMyEmerContacts(): Promise<Array<EmergencyContact>>;
    getUserAccidents(): Promise<Array<AccidentRecord>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    reportAccident(record: AccidentRecord): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    saveProfile(profile: UserProfile): Promise<void>;
    sendSms(phone: string, message: string): Promise<void>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
}
