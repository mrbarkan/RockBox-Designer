
import { SongMetadata } from '../types';

declare global {
  interface Window {
    jsmediatags: any;
  }
}

export const parseAudioFile = (file: File): Promise<SongMetadata> => {
  return new Promise((resolve, reject) => {
    // Default metadata based on filename
    const metadata: SongMetadata = {
      title: file.name.replace(/\.[^/.]+$/, ""),
      artist: "Unknown Artist",
      album: "Unknown Album",
      trackNum: 1,
      totalTracks: 1,
      currentSec: 0,
      totalSec: 180, // Default 3 mins if duration read fails
      format: file.name.split('.').pop()?.toUpperCase() || "MP3",
      kbps: 128,
      albumArt: undefined
    };

    // Helper to read ID3 tags using jsmediatags if available
    const readTags = () => {
      if (window.jsmediatags) {
        window.jsmediatags.read(file, {
          onSuccess: (tag: any) => {
            const tags = tag.tags;
            
            metadata.title = tags.title || metadata.title;
            metadata.artist = tags.artist || metadata.artist;
            metadata.album = tags.album || metadata.album;
            
            // Handle Track "1" or "1/12"
            if (tags.track) {
                const trackParts = tags.track.toString().split('/');
                metadata.trackNum = parseInt(trackParts[0]) || 1;
                if (trackParts[1]) metadata.totalTracks = parseInt(trackParts[1]);
            }

            // Handle Album Art
            if (tags.picture) {
                const { data, format } = tags.picture;
                let base64String = "";
                for (let i = 0; i < data.length; i++) {
                    base64String += String.fromCharCode(data[i]);
                }
                metadata.albumArt = `data:${format};base64,${window.btoa(base64String)}`;
            }

            resolve(metadata);
          },
          onError: (error: any) => {
            console.warn("ID3 read error:", error);
            // Resolve with basic file info if tags fail, don't reject
            resolve(metadata); 
          }
        });
      } else {
        // Fallback if jsmediatags is missing
        resolve(metadata);
      }
    };

    // 1. Get Duration via HTML Audio Element
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio(objectUrl);

    audio.onloadedmetadata = () => {
      const duration = Math.floor(audio.duration);
      
      // Calculate estimated bitrate if duration is valid
      if (duration && !isNaN(duration) && duration !== Infinity) {
          metadata.totalSec = duration;
          const kbps = Math.floor((file.size * 8) / duration / 1000);
          metadata.kbps = kbps || 128;
      }
      
      URL.revokeObjectURL(objectUrl); // Clean up
      readTags();
    };

    audio.onerror = () => {
        // Warning instead of Reject: allows unsupported formats (like FLAC on some browsers) 
        // to still display metadata extracted via jsmediatags, even if duration is unknown.
        console.warn("Browser could not decode audio stream for duration calculation.");
        URL.revokeObjectURL(objectUrl);
        readTags();
    };
  });
};
