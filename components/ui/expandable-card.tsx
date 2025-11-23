// components/ui/expandable-card.tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ExpandableCardProps {
  title: string;
  src: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
  classNameExpanded?: string;
  [key: string]: any;
}

export function ExpandableCard({
  title,
  src,
  description,
  children,
  className,
  classNameExpanded,
  ...props
}: ExpandableCardProps) {
  const [active, setActive] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const id = React.useId();

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(false);
    };

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setActive(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  return (
    <>
      {/* затемнение фона при открытой истории */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 h-full w-full bg-slate-900/40 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* модалка с полной историей */}
      <AnimatePresence>
        {active && (
          <div className="fixed inset-0 z-50 grid place-items-center sm:mt-16">
            <motion.div
              layoutId={`card-${title}-${id}`}
              ref={cardRef}
              className={cn(
                "relative flex h-full max-h-[90vh] w-full max-w-3xl flex-col overflow-auto rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200",
                "dark:bg-slate-950 dark:ring-slate-800",
                classNameExpanded,
              )}
              {...props}
            >
              {/* картинка сверху */}
              <motion.div layoutId={`image-${title}-${id}`}>
                <div className="relative">
                  <img
                    src={src}
                    alt={title}
                    className="h-64 w-full rounded-t-3xl object-cover object-center"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/90 to-transparent dark:from-slate-950/90" />
                </div>
              </motion.div>

              {/* контент */}
              <div className="relative flex-1 px-6 pb-8 pt-4 sm:px-8">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <motion.p
                      layoutId={`description-${description}-${id}`}
                      className="text-sm text-slate-500 dark:text-slate-400"
                    >
                      {description}
                    </motion.p>
                    <motion.h3
                      id={`card-title-${id}`}
                      layoutId={`title-${title}-${id}`}
                      className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white sm:text-3xl"
                    >
                      {title}
                    </motion.h3>
                  </div>

                  <motion.button
                    aria-label="Close story"
                    layoutId={`button-${title}-${id}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800"
                    onClick={() => setActive(false)}
                  >
                    <motion.div
                      animate={{ rotate: active ? 45 : 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12h14" />
                        <path d="M12 5v14" />
                      </svg>
                    </motion.div>
                  </motion.button>
                </div>

                <motion.div
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300"
                >
                  {children}
                </motion.div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* компактная карточка в сетке историй */}
      <motion.div
        role="button"
        aria-labelledby={`card-title-${id}`}
        aria-modal="true"
        layoutId={`card-${title}-${id}`}
        onClick={() => setActive(true)}
        className={cn(
          "flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg",
          "dark:border-slate-800 dark:bg-slate-950",
          className,
        )}
      >
        <div className="flex flex-col gap-4">
          <motion.div layoutId={`image-${title}-${id}`}>
            <img
              src={src}
              alt={title}
              className="h-44 w-full rounded-xl object-cover object-center"
            />
          </motion.div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <motion.p
                layoutId={`description-${description}-${id}`}
                className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                {description}
              </motion.p>
              <motion.h3
                layoutId={`title-${title}-${id}`}
                className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white"
              >
                {title}
              </motion.h3>
            </div>

            <motion.button
              aria-label="Open story"
              layoutId={`button-${title}-${id}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              <motion.div
                animate={{ rotate: active ? 45 : 0 }}
                transition={{ duration: 0.25 }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
              </motion.div>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
