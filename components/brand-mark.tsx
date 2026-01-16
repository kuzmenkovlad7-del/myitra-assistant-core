import React from "react";

export default function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M10 34c7-10 18-16 30-16 5 0 10 1 14 3"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.95"
      />
      <path
        d="M12 46c6-7 14-11 24-11 8 0 15 2 22 6"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        d="M14 25c6-8 14-13 24-13 6 0 11 1 16 4"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}
