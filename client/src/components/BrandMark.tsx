export function BrandMark({ compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <span className={`brand ${compact ? "brand--compact" : ""}`} aria-label="OralCare+">
      <img className={compact ? "brand__image brand__image--mark" : "brand__image"} src={compact ? "/oralcare-logo-mark-transparent.webp" : "/oralcare-logo-transparent.webp"} alt="OralCare+ — Better Dental Care, Made Simple." decoding="async" fetchPriority="high" />
    </span>
  );
}
