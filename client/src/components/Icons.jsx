export function Icon({ name, size = 18, className = "", title }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    className,
    "aria-hidden": title ? undefined : "true",
    role: title ? "img" : undefined
  };

  const stroke = "currentColor";
  const s = { stroke, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

  const paths = {
    pin: (
      <>
        <path {...s} d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z" />
        <path {...s} d="M12 11a2 2 0 1 0 0.001 0Z" />
      </>
    ),
    parking: (
      <>
        <path {...s} d="M7 20V4h7a5 5 0 1 1 0 10H7" />
        <path {...s} d="M7 14h7" />
      </>
    ),
    phone: (
      <>
        <path
          {...s}
          d="M8 3h3l1.2 4.2-2 1.2a14 14 0 0 0 6.4 6.4l1.2-2L21 14v3c0 2-1.6 3-3.4 3A16.6 16.6 0 0 1 4 6.4C4 4.6 5 3 7 3Z"
        />
      </>
    ),
    sparkle: (
      <>
        <path {...s} d="M12 2l1.3 4.6L18 8l-4.7 1.4L12 14l-1.3-4.6L6 8l4.7-1.4L12 2Z" />
        <path {...s} d="M19 14l.8 2.8L22 18l-2.2.7L19 22l-.8-3.3L16 18l2.2-1.2L19 14Z" />
      </>
    )
  };

  return (
    <svg {...common}>
      {title ? <title>{title}</title> : null}
      {paths[name] || null}
    </svg>
  );
}

