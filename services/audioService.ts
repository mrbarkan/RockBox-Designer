import { SongMetadata } from '../types';

declare global {
  interface Window {
    jsmediatags: any;
  }
}

export const parseAudioFile = (file: File): Promise<SongMetadata> => {
  return new Promise((resolve, reject) => {
    // 1. Get Duration via HTML Audio Element
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio(objectUrl);

    audio.onloadedmetadata = () => {
      const duration = Math.floor(audio.duration);
      
      // Calculate estimated bitrate: (Size in bits) / (Duration in seconds) / 1000 = kbps
      const kbps = Math.floor((file.size * 8) / duration / 1000);
      
      // Default metadata structure
      const metadata: SongMetadata = {
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: "Unknown Artist",
        album: "Unknown Album",
        trackNum: 1,
        totalTracks: 1,
        currentSec: 0,
        totalSec: duration || 180,
        format: file.name.split('.').pop()?.toUpperCase() || "MP3",
        kbps: kbps || 128,
        albumArt: undefined
      };

      // 2. Attempt to read ID3 tags if library is loaded
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
            URL.revokeObjectURL(objectUrl); // Clean up
          },
          onError: (error: any) => {
            console.warn("ID3 read error:", error);
            // Resolve with basic file info if tags fail
            resolve(metadata); 
            URL.revokeObjectURL(objectUrl);
          }
        });
      } else {
        // Fallback if jsmediatags is missing
        resolve(metadata);
        URL.revokeObjectURL(objectUrl);
      }
    };

    audio.onerror = () => {
        reject(new Error("Could not load audio file."));
        URL.revokeObjectURL(objectUrl);
    };
  });
};
