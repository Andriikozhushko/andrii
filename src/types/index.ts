export type Screen = "home" | "create" | "open" | "verify";

export interface PasswordStrengthResult {
  score: number;
  label: string;
  entropy_bits: number;
  estimated_crack_time: string;
  has_lowercase: boolean;
  has_uppercase: boolean;
  has_digits: boolean;
  has_symbols: boolean;
  length: number;
  suggestions: string[];
}

export interface CreateArchiveRequest {
  file_paths: string[];
  output_path: string;
  archive_name: string;
  password: string;
  compression: "Fast" | "Balanced" | "Maximum";
}

export interface CreateArchiveResponse {
  output_path: string;
  file_count: number;
  total_original_size: number;
  total_compressed_size: number;
  compression_ratio: number;
}

export interface ArchiveFileEntry {
  path: string;
  original_size: number;
  compressed_size: number;
  modified_at: number;
  compression_ratio: number;
}

export interface OpenArchiveResponse {
  archive_name: string;
  created_at: number;
  creator_version: string;
  compression: string;
  file_count: number;
  total_original_size: number;
  total_compressed_size: number;
  entries: ArchiveFileEntry[];
}

export interface VerifyResult {
  is_valid: boolean;
  has_valid_magic: boolean;
  format_version: number;
  version_supported: boolean;
  integrity_hash_valid: boolean;
  file_size: number;
  error: string | null;
}

export interface ProgressEvent {
  current: number;
  total: number;
  current_file: string;
}

export type CompressionLevel = "Fast" | "Balanced" | "Maximum";
