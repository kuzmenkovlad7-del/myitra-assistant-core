import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap } from "lucide-react";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Props for the MissionSuccessDialog component.
 */
interface MissionSuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
  description: string;
  inputPlaceholder?: string;
  primaryButtonText: string;
  onPrimaryClick: (inputValue: string) => void;
  secondaryButtonText: string;
  onSecondaryClick: () => void;
  badgeText?: string;
  badgeIcon?: React.ReactNode;
}

export const MissionSuccessDialog: React.FC<MissionSuccessDialogProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title,
  description,
  inputPlaceholder = "Enter a value",
  primaryButtonText,
  onPrimaryClick,
  secondaryButtonText,
  onSecondaryClick,
  badgeText,
  badgeIcon,
}) => {
  const [inputValue, setInputValue] = React.useState("");

  const handlePrimaryClick = () => {
    onPrimaryClick(inputValue);
    onClose();
  };

  const handleSecondaryClick = () => {
    onSecondaryClick();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 18 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-xl"
          >
            <div className="relative p-8 text-center">
              {/* Badge */}
              {badgeText && (
                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                  {badgeIcon}
                  <span>{badgeText}</span>
                </div>
              )}

              {/* Close */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-4 h-8 w-8 rounded-full"
                onClick={onClose}
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </Button>

              {/* Image */}
              <div className="mx-auto mb-4 flex h-44 w-44 items-center justify-center">
                <img
                  src={imageUrl}
                  alt="Mission illustration"
                  className="max-h-full max-w-full object-contain drop-shadow-[0_10px_15px_rgba(150,120,255,0.4)]"
                />
              </div>

              <h2 className="mb-2 flex items-center justify-center gap-2 text-2xl font-bold text-card-foreground">
                <Zap className="h-5 w-5 text-yellow-400" />
                {title}
              </h2>

              <p className="mb-6 text-sm text-muted-foreground">{description}</p>

              <div className="flex flex-col gap-4">
                <Input
                  type="text"
                  placeholder={inputPlaceholder}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="bg-secondary text-center text-secondary-foreground placeholder:text-muted-foreground"
                />
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
