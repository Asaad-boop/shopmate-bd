import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface IntegrationButtonProps {
  configured: boolean;
  integrationName: string;
  children: React.ReactNode;
  className?: string;
  /** If true, show a grey disabled button instead of hiding completely */
  showDisabled?: boolean;
}

export function IntegrationButton({ configured, integrationName, children, className, showDisabled = true }: IntegrationButtonProps) {
  const navigate = useNavigate();

  if (configured) {
    return <>{children}</>;
  }

  if (!showDisabled) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("opacity-50 cursor-not-allowed gap-1.5", className)}
          onClick={() => navigate("/settings")}
        >
          <Settings className="w-3.5 h-3.5" />
          Configure {integrationName}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Configure {integrationName} in Settings to enable this feature</p>
      </TooltipContent>
    </Tooltip>
  );
}
