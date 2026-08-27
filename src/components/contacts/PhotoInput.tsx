"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import Button from "@/components/ui/Button";
import { PHOTO_MAX_LENGTH } from "@/lib/contacts/schema";

/** Refuse files this large before even decoding them. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Longest edge after downscaling — plenty for an avatar. */
const TARGET_EDGE = 512;

/**
 * Downscale the image to avatar size and re-encode it as a JPEG data URL, so
 * even a huge camera photo becomes a payload the API accepts. GIFs are kept
 * as-is (re-encoding would freeze the animation) and merely size-checked.
 */
async function fileToDataUrl(file: File): Promise<string> {
  if (file.type === "image/gif") {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    if (dataUrl.length > PHOTO_MAX_LENGTH) {
      throw new Error("That GIF is over 1 MB. Try a smaller one.");
    }
    return dataUrl;
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, TARGET_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read that image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

/**
 * Circular photo preview plus upload/remove controls. The chosen image lives
 * in a hidden `photo` input as a data URL, so the surrounding form submits it
 * like any other field — and the edit form carries an existing photo through
 * a full-replace PUT untouched.
 */
export default function PhotoInput({
  defaultValue,
  error,
}: {
  defaultValue?: string;
  error?: string;
}) {
  const [photo, setPhoto] = useState(defaultValue ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Conversions are async, so a slow one could finish after a newer selection
  // (or after Remove) and clobber it. Each user action bumps the token; a
  // conversion only lands if its token is still the latest.
  const operationRef = useRef(0);

  async function onFileChange(files: FileList | null) {
    const operation = ++operationRef.current;
    const file = files?.item(0);
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setLocalError("That file is not an image.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setLocalError("That image is over 10 MB. Try a smaller one.");
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      if (operationRef.current !== operation) return;
      setPhoto(dataUrl);
      setLocalError(null);
    } catch (cause) {
      if (operationRef.current !== operation) return;
      setLocalError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Could not read that image.",
      );
    }
  }

  function removePhoto() {
    operationRef.current += 1;
    setPhoto("");
    setLocalError(null);
  }

  const message = localError ?? error;

  return (
    <div>
      <div className="flex items-center gap-4">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL, not an optimizable asset
          <img
            src={photo}
            alt="Photo preview"
            className="h-20 w-20 shrink-0 select-none rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex h-20 w-20 shrink-0 select-none items-center justify-center rounded-full border border-dashed border-border text-muted-foreground/60"
          >
            <ImagePlus className="h-6 w-6" strokeWidth={1.5} />
          </span>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            {photo ? "Replace photo" : "Upload photo"}
          </Button>
          {photo ? (
            <Button variant="ghost" size="sm" onClick={removePhoto}>
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        aria-label="Choose a photo"
        tabIndex={-1}
        onChange={(event) => onFileChange(event.currentTarget.files)}
      />
      <input type="hidden" name="photo" value={photo} />

      {message ? (
        <p role="alert" className="mt-2 text-[13px] text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  );
}
