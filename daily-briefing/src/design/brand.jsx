// CloudTalk brand marks.
//
// Drawn as inline SVG rather than shipped as a file so the mark inherits the
// surrounding colour where we want it to and stays crisp at any rail width. The
// glyph is the CloudTalk "C" - a thick open ring with a speech-bubble tail,
// which is what separates it from a generic letter C.

export const BRAND_BLUE = "#1226FF";

export function CloudTalkMark({ size = 28, color = BRAND_BLUE, style }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 512 512"
      fill="none" aria-hidden="true" style={style}
    >
      <path
        d="M367.1 146.8 A145 145 0 1 0 367.1 333.2"
        stroke={color} strokeWidth="90" strokeLinecap="round"
      />
      <path d="M240 400 h32 l-16 78 z" fill={color} />
    </svg>
  );
}

// The mark sitting on its own tile, for the collapsed rail and anywhere else it
// needs to read as an app icon rather than as part of a lockup.
export function CloudTalkBadge({ size = 28, radius = 8, style }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: radius, flexShrink: 0,
        background: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        ...style,
      }}
    >
      <CloudTalkMark size={Math.round(size * 0.74)} />
    </div>
  );
}
