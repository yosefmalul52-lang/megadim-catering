export interface Video {
  id: string;
  title: string;
  youtubeUrl: string;
  videoId: string;
  thumbnailUrl: string;
  order?: number;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateVideoRequest {
  title: string;
  youtubeUrl: string;
}

export interface UpdateVideoRequest {
  title?: string;
  youtubeUrl?: string;
  order?: number;
  isActive?: boolean;
}

