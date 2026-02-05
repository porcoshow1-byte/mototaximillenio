/**
 * Compresses an image file if it exceeds a certain size limit.
 * Uses HTML Canvas to resize and compress the image.
 * 
 * @param file The original File object
 * @param maxSizeMB Maximum allowed size in MB (default 1MB)
 * @param maxWidth Maximum width in pixels (default 1280px)
 * @param quality JPEG quality from 0 to 1 (default 0.8)
 * @returns Promise resolving to the compressed File (or original if small enough)
 */
export const compressImage = async (
    file: File,
    maxSizeMB: number = 1,
    maxWidth: number = 1280,
    quality: number = 0.8
): Promise<File> => {
    // If file is smaller than limit, return as is
    if (file.size <= maxSizeMB * 1024 * 1024) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Resize if too wide
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas context not available'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Compression failed'));
                            return;
                        }

                        // Create new File object
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });

                        console.log(`Image compressed: ${(file.size / 1024).toFixed(2)}KB -> ${(compressedFile.size / 1024).toFixed(2)}KB`);
                        resolve(compressedFile);
                    },
                    'image/jpeg',
                    quality
                );
            };

            img.onerror = (err) => reject(err);
        };

        reader.onerror = (err) => reject(err);
    });
};
