export type VideoSource = 'youtube' | 'cloudinary';

/** Resolve playback source for legacy rows missing `source`. */
export function resolveVideoSource(video: {
  source?: string;
  videoUrl?: string;
  videoId?: string;
  youtubeUrl?: string;
}): VideoSource {
  if (video.source === 'cloudinary' || video.source === 'youtube') {
    return video.source;
  }
  if (video.videoUrl?.trim()) {
    return 'cloudinary';
  }
  return 'youtube';
}

/** Derive thumbnail URL from Cloudinary video delivery URL (.mp4 → .jpg). */
export function cloudinaryVideoThumbnailFromUrl(videoUrl: string): string {
  if (!videoUrl?.trim()) {
    return '';
  }
  return videoUrl.trim().replace(/\.(mp4|webm|mov|quicktime)(\?.*)?$/i, '.jpg$2');
}
