import { useCallback, useEffect, useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Eye, RotateCcw, Upload, X, ZoomIn, ZoomOut, Check } from 'lucide-react';

export type CropPresetKey =
  | 'hero_banner'
  | 'product_main'
  | 'product_thumb'
  | 'brand_section'
  | 'promo_banner'
  | 'review_avatar';

export const CROP_PRESETS: Record<
  CropPresetKey,
  { label: string; aspect: number; ratioLabel: string; targetWidth: number }
> = {
  hero_banner: { label: 'Hero Banner', aspect: 16 / 9, ratioLabel: '16:9', targetWidth: 1600 },
  product_main: { label: 'Product Main Image', aspect: 1, ratioLabel: '1:1', targetWidth: 1000 },
  product_thumb: { label: 'Product Thumbnail', aspect: 1, ratioLabel: '1:1', targetWidth: 600 },
  brand_section: { label: 'Brand Section', aspect: 4 / 3, ratioLabel: '4:3', targetWidth: 1200 },
  promo_banner: { label: 'Promotional Banner', aspect: 16 / 9, ratioLabel: '16:9', targetWidth: 1400 },
  review_avatar: { label: 'Customer Review Image', aspect: 1, ratioLabel: '1:1', targetWidth: 500 },
};

interface ImageCropUploaderProps {
  token: string;
  preset?: CropPresetKey;
  folder: 'hero' | 'products' | 'brand' | 'reviews' | 'branding' | 'general';
  label?: string;
  currentImageUrl?: string;
  onUploaded: (url: string) => void;
  allowPresetSwitch?: boolean;
}

async function getCroppedImageDataUrl(
  imageSrc: string,
  pixelCrop: Area,
  maxWidth: number
): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = imageSrc;
  });

  const scale = pixelCrop.width > maxWidth ? maxWidth / pixelCrop.width : 1;
  const outWidth = Math.max(1, Math.round(pixelCrop.width * scale));
  const outHeight = Math.max(1, Math.round(pixelCrop.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outWidth,
    outHeight
  );

  // Use WebP for crisp quality and compact storage size, fallback to JPEG
  const webp = canvas.toDataURL('image/webp', 0.9);
  if (webp.startsWith('data:image/webp')) return webp;
  return canvas.toDataURL('image/jpeg', 0.9);
}

export function ImageCropUploader({
  token,
  preset = 'product_main',
  folder,
  label = 'Upload & Crop Image',
  currentImageUrl,
  onUploaded,
  allowPresetSwitch = true,
}: ImageCropUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<CropPresetKey>(preset);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('image');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedPreset(preset);
  }, [preset]);

  const activePreset = CROP_PRESETS[selectedPreset];

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, or WebP).');
      return;
    }
    setError(null);
    setFileName(file.name.replace(/\.[^.]+$/, ''));
    const reader = new FileReader();
    reader.onload = () => {
      setSourceUrl(String(reader.result));
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setPreviewDataUrl(null);
      setShowLivePreview(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleResetCrop = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setPreviewDataUrl(null);
    setShowLivePreview(false);
  };

  const handleGeneratePreview = async () => {
    if (!sourceUrl || !croppedAreaPixels) return;
    try {
      const dataUrl = await getCroppedImageDataUrl(
        sourceUrl,
        croppedAreaPixels,
        activePreset.targetWidth
      );
      setPreviewDataUrl(dataUrl);
      setShowLivePreview(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSaveAndUpload = async () => {
    if (!sourceUrl || !croppedAreaPixels) return;
    setUploading(true);
    setError(null);
    try {
      const dataUrl = await getCroppedImageDataUrl(
        sourceUrl,
        croppedAreaPixels,
        activePreset.targetWidth
      );

      const res = await fetch('/api/admin/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dataUrl,
          folder,
          fileName,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Image upload failed');
      }

      onUploaded(body.url);
      setSourceUrl(null);
      setPreviewDataUrl(null);
      setShowLivePreview(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          onChange={handleFilePick}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Upload className="w-3.5 h-3.5 text-[#4C8C3B]" />
          {label}
        </button>
        <span className="text-xs text-slate-500">
          Ratio: {activePreset.label} ({activePreset.ratioLabel})
        </span>
      </div>

      {currentImageUrl && (
        <div className="flex items-center gap-3 p-2 rounded-lg border border-slate-200 bg-slate-50">
          <img
            src={currentImageUrl}
            alt="Current asset"
            referrerPolicy="no-referrer"
            className="w-14 h-14 rounded-md object-cover border border-slate-200 bg-white shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-700 truncate">{currentImageUrl}</p>
            <p className="text-[11px] text-slate-500">Saved asset ready on storefront</p>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
          {error}
        </p>
      )}

      {/* Interactive Cropping Modal */}
      {sourceUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="font-sans text-sm font-semibold text-slate-900">
                  Interactive Image Cropper
                </h3>
                <p className="text-xs text-slate-500">
                  Drag to reposition, zoom cleanly, and verify your website preview before saving.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSourceUrl(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-900 cursor-pointer"
                aria-label="Close cropper"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {allowPresetSwitch && (
              <div className="px-5 py-2.5 border-b border-slate-200 bg-white flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-slate-500 mr-2">Preset Ratio:</span>
                {(Object.keys(CROP_PRESETS) as CropPresetKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(key);
                      setShowLivePreview(false);
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      selectedPreset === key
                        ? 'bg-[#4C8C3B] text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {CROP_PRESETS[key].label} ({CROP_PRESETS[key].ratioLabel})
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12">
              {/* Cropper Canvas */}
              <div className="lg:col-span-8 relative bg-neutral-900 min-h-[340px] sm:min-h-[420px]">
                <Cropper
                  image={sourceUrl}
                  crop={crop}
                  zoom={zoom}
                  aspect={activePreset.aspect}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  showGrid={true}
                />
              </div>

              {/* Controls & Live Storefront Context Preview */}
              <div className="lg:col-span-4 p-5 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col justify-between gap-4 overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-2">
                      <span className="flex items-center gap-1.5">
                        <ZoomIn className="w-3.5 h-3.5" /> Zoom Level
                      </span>
                      <span className="font-mono-tabular">{zoom.toFixed(2)}x</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ZoomOut className="w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.05}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-full accent-[#4C8C3B]"
                      />
                      <ZoomIn className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetCrop}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={handleGeneratePreview}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#4C8C3B]" />
                      Preview
                    </button>
                  </div>

                  {showLivePreview && previewDataUrl && (
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <p className="text-xs font-semibold text-slate-700">
                        Website Placement Preview ({activePreset.ratioLabel})
                      </p>
                      <div className="rounded-lg overflow-hidden border border-slate-200 bg-[#F7F4EE] p-2">
                        <img
                          src={previewDataUrl}
                          alt="Cropped preview"
                          className="w-full rounded-md object-cover"
                          style={{ aspectRatio: String(activePreset.aspect) }}
                        />
                        <p className="mt-1.5 text-[11px] text-slate-600 text-center">
                          Zero distortion · Aspect ratio locked
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={handleSaveAndUpload}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#4C8C3B] text-white text-xs font-semibold hover:bg-[#3D732E] disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    {uploading ? 'Uploading to Storage...' : 'Save & Upload Image'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceUrl(null)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
