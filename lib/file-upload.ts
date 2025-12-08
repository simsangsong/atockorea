/**
 * File upload validation and utilities
 */

export interface FileUploadOptions {
  maxSize: number; // in bytes
  allowedTypes: string[]; // MIME types
  maxFiles?: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate file before upload
 */
export function validateFile(
  file: File,
  options: FileUploadOptions
): ValidationResult {
  // Check file size
  if (file.size > options.maxSize) {
    const maxSizeMB = (options.maxSize / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
    };
  }

  // Check file type
  if (!options.allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${options.allowedTypes.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Validate multiple files
 */
export function validateFiles(
  files: File[],
  options: FileUploadOptions
): ValidationResult {
  // Check number of files
  if (options.maxFiles && files.length > options.maxFiles) {
    return {
      valid: false,
      error: `Maximum ${options.maxFiles} files allowed`,
    };
  }

  // Validate each file
  for (const file of files) {
    const result = validateFile(file, options);
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true };
}

/**
 * Default file upload options for product images
 */
export const productImageOptions: FileUploadOptions = {
  maxSize: 5 * 1024 * 1024, // 5MB
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  maxFiles: 10,
};

/**
 * Default file upload options for gallery images
 */
export const galleryImageOptions: FileUploadOptions = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  maxFiles: 20,
};

