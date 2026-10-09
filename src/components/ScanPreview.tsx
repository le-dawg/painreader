type ScanPreviewProps = {
  imageUrl: string | null;
  compact?: boolean;
};

export function ScanPreview({ imageUrl, compact = false }: ScanPreviewProps) {
  return (
    <figure className={`scan-preview${compact ? " scan-preview-compact" : ""}`}>
      {imageUrl ? <img src={imageUrl} alt="Processed document preview" /> : <div className="scan-empty">Wird vorbereitet</div>}
    </figure>
  );
}
