import { useState } from "react";
import { Plus, Camera, Video, ImageIcon, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FabMenuProps {
  onPickPhoto: () => void;
  onPickVideo: () => void;
  onPickFile: () => void;
  onPickNote: () => void;
}

export function FabMenu({ onPickPhoto, onPickVideo, onPickFile, onPickNote }: FabMenuProps) {
  const [open, setOpen] = useState(false);

  const items = [
    { icon: Camera, label: "Tomar foto", action: onPickPhoto },
    { icon: Video, label: "Grabar video", action: onPickVideo },
    { icon: ImageIcon, label: "Subir archivo", action: onPickFile },
    { icon: FileText, label: "Nota", action: onPickNote },
  ];

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {open &&
          items.map((it, i) => (
            <div
              key={it.label}
              className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <span className="bg-card border rounded-full px-3 py-1.5 text-sm shadow-md">
                {it.label}
              </span>
              <Button
                size="icon"
                variant="default"
                className="h-12 w-12 rounded-full shadow-lg"
                onClick={() => {
                  setOpen(false);
                  it.action();
                }}
              >
                <it.icon className="h-5 w-5" />
              </Button>
            </div>
          ))}
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-xl"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Cerrar" : "Añadir entrada"}
        >
          {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>
      </div>
    </>
  );
}
