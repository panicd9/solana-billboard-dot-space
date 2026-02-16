import { useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Upload, Wallet, Grid3X3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Selection } from "@/components/PixelCanvas";

interface Props {
  selection: Selection | null;
  onClearSelection: () => void;
  onImageUpload: (file: File) => void;
}

const CanvasToolbar = ({ selection, onClearSelection, onImageUpload }: Props) => {
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    if (!selection) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageUpload(file);
      e.target.value = "";
    }
  };

  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "";

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <Grid3X3 className="w-6 h-6 text-primary" />
        <h1 className="text-lg font-semibold tracking-tight">
          <span className="text-primary text-glow">Sol</span>
          <span className="text-foreground">Canvas</span>
        </h1>
      </div>

      <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
        {selection ? (
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-md bg-secondary border border-border">
            <span>
              ({selection.col}, {selection.row})
            </span>
            <span className="text-primary">
              {selection.width}×{selection.height}
            </span>
            <span className="text-muted-foreground">
              {selection.width * selection.height} blocks
            </span>
            <button onClick={onClearSelection} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <span className="text-muted-foreground">Click and drag to select blocks</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={!selection}
          onClick={handleUploadClick}
          className="gap-2"
        >
          <Upload className="w-4 h-4" />
          Upload
        </Button>

        {connected ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => disconnect()}
            className="gap-2 border-primary/30 text-primary"
          >
            <Wallet className="w-4 h-4" />
            {shortAddress}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => setVisible(true)}
            className="gap-2"
          >
            <Wallet className="w-4 h-4" />
            Connect
          </Button>
        )}
      </div>
    </header>
  );
};

export default CanvasToolbar;
