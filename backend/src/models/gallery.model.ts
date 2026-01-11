export interface GalleryItem {
  id: string;
  title?: string;
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
  order?: number;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateGalleryItemRequest {
  title?: string;
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
  order?: number;
  isActive?: boolean;
}

export interface UpdateGalleryItemRequest {
  title?: string;
  type?: 'image' | 'video';
  url?: string;
  thumbnail?: string;
  order?: number;
  isActive?: boolean;
}

