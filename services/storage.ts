import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, isMockMode } from './firebase';

/**
 * Uploads a file to Firebase Storage or returns a base64 string in mock mode.
 * @param file The file to upload
 * @param path The path in storage (e.g., 'avatars/user_123')
 * @returns Promise<string> The download URL
 */
export const uploadFile = async (file: File, path: string): Promise<string> => {
    // Fallback for Mock Mode or if Storage is not configured
    if (isMockMode || !storage) {
        console.warn("Storage upload mocked (Base64)");
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    try {
        const storageRef = ref(storage, path);
        // Add some metadata if needed
        const metadata = {
            contentType: file.type,
        };

        const snapshot = await uploadBytes(storageRef, file, metadata);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error) {
        console.error("Error uploading file to Firebase Storage:", error);
        throw error;
    }
};

/**
 * Compresses and resizes an image file to fit within maxSize and reduce file size.
 * Returns a new File object with JPEG compression.
 * @param file Original image file
 * @param maxWidthHeight Maximum width or height (default 800px)
 * @param quality JPEG quality 0-1 (default 0.7)
 * @returns Promise<File> Compressed file
 */
export const compressImage = (
    file: File,
    maxWidthHeight: number = 800,
    quality: number = 0.7
): Promise<File> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                // Calculate new dimensions maintaining aspect ratio
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidthHeight) {
                        height = Math.round((height * maxWidthHeight) / width);
                        width = maxWidthHeight;
                    }
                } else {
                    if (height > maxWidthHeight) {
                        width = Math.round((width * maxWidthHeight) / height);
                        height = maxWidthHeight;
                    }
                }

                // Create canvas and draw resized image
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    reject(new Error('Canvas context not available'));
                    return;
                }

                // Draw with smooth scaling
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to blob with compression
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Failed to compress image'));
                            return;
                        }
                        // Create new File from blob
                        const compressedFile = new File(
                            [blob],
                            file.name.replace(/\.[^.]+$/, '.jpg'),
                            { type: 'image/jpeg', lastModified: Date.now() }
                        );
                        console.log(`Image compressed: ${(file.size / 1024).toFixed(1)}KB -> ${(compressedFile.size / 1024).toFixed(1)}KB`);
                        resolve(compressedFile);
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = () => reject(new Error('Failed to load image'));
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
    });
};
