"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MissionSuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;

  /** Optional: image url (if you want a picture) */
  imageUrl?: string;

  /** Preferred: illustration ReactNode (icons, etc) */
  illustration?: React.ReactNode;

  title: string;
  description: string;

  /** Optional title icon */
  titleIcon?: React.ReactNode;

  /** Input can be hidden for payment success */
  showInput?: boolean;
  inputPlaceholder?: string;

  primaryButtonText: string;
  onPrimaryClick?: (inputValue: string) => void;

  secondaryButtonText: string;
  onSecondaryClick?: () => void;

  badgeText?: string;
  badgeIcon?: React.ReactNode;
}

export const MissionSuccessDialog: React.FC<MissionSuccessDialogProps> = ({
  isOpen,
  onClose,
  imageUrl,
  illustration,
  title,
  titleIcon,
  description,
  showInput = true,
  inputPlaceholder = "Enter a value",
  primaryButtonText,
  onPrimaryClick,
  secondaryButtonText,
  onSecondaryClick,
  badgeText,
  badgeIcon,
}) => {
  const [inputValue, setInputValue] = React.useState("");

  React.useEffect(() => {
    if (!isOpen) setInputValue("");
  }, [isOpen]);

  const handlePrimaryClick = () => {
    onPrimaryClick?.(inputValue);
    onClose();
  };

  const handleSecondaryClick = () => {
    onSecondaryClick?.();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-xl"
          >
            <div className="relative p-8 text-center">
              {badgeText && (
                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                  {badgeIcon}
                  <span>{badgeText}</span>
                </div>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-4 h-8 w-8 rounded-full"
                onClick={onClose}
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center">
                {illustration ? (
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-secondary">
                    {illustration}
                  </div>
                ) : imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Illustration"
                    className={cn(
                      "max-h-full max-w-full object-contain",
                      "drop-shadow-[0_10px_15px_rgba(150,120,255,0.25)]"
                    )}
                  />
                ) : (
                  <div className="h-24 w-24 rounded-2xl bg-secondary" />
                )}
              </div>

              <h2 className="mb-2 flex items-center justify-center gap-2 text-2xl font-bold text-card-foreground">
                {titleIcon}
                {title}
              </h2>

              <p className="mb-6 text-sm text-muted-foreground">{description}</p>

              <div className="flex flex-col gap-4">
                {showInput && (
                  <Input
                    type="text"
                    placeholder={inputPlaceholder}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="bg-secondary text-center text-secondary-foreground placeholder:text-muted-foreground"
                  />
                )}

                <Button onClick={handlePrimaryClick} size="lg" className="w-full">
                  {primaryButtonText}
                </Button>

                <Button
                  variant="link"
                  onClick={handleSecondaryClick}
                  className="text-muted-foreground"
                >
                  {secondaryButtonText}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
