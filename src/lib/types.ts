export type ShowStatus = "draft" | "in_production" | "published";
export type EpisodeStatus = "draft" | "generating" | "ready" | "published";
export type SceneStatus = "draft" | "queued" | "processing" | "ready" | "failed";
export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Show {
  id: string;
  owner_id: string;
  title: string;
  logline: string | null;
  genre: string | null;
  status: ShowStatus;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Character {
  id: string;
  show_id: string;
  name: string;
  description: string | null;
  reference_image_url: string | null;
  created_at: string;
}

export interface World {
  id: string;
  show_id: string;
  name: string;
  description: string | null;
  reference_image_url: string | null;
  created_at: string;
}

export interface Episode {
  id: string;
  show_id: string;
  episode_number: number;
  title: string;
  synopsis: string | null;
  status: EpisodeStatus;
  video_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

export interface Scene {
  id: string;
  episode_id: string;
  scene_number: number;
  prompt: string;
  character_ids: string[];
  world_id: string | null;
  reference_image_url: string | null;
  status: SceneStatus;
  video_url: string | null;
  created_at: string;
}

export interface GenerationJob {
  id: string;
  scene_id: string;
  provider_task_id: string | null;
  model: string;
  status: JobStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
}
