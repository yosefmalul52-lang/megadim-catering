export type VideoSource = 'youtube' | 'cloudinary';

export interface Video {
  id: string;
  title: string;
  source?: VideoSource;
  youtubeUrl?: string;
  videoId?: string;
  videoUrl?: string;
  publicId?: string;
  thumbnailUrl: string;
  order?: number;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateVideoRequest {
  title: string;
  source: VideoSource;
  youtubeUrl?: string;
  videoUrl?: string;
  publicId?: string;
  thumbnailUrl?: string;
}

export interface UpdateVideoRequest {
  title?: string;
  source?: VideoSource;
  youtubeUrl?: string;
  videoUrl?: string;
  publicId?: string;
  thumbnailUrl?: string;
  order?: number;
  isActive?: boolean;
}
