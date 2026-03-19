import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const AVATAR_COLORS = [
  "bg-blue-600", "bg-emerald-600", "bg-violet-600", "bg-amber-600",
  "bg-rose-600", "bg-teal-600", "bg-indigo-600", "bg-orange-600",
];

function getAvatarColor(email: string) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const email = user?.email || "user@app.com";
  const initials = email.substring(0, 2).toUpperCase();
  const displayName = user?.user_metadata?.full_name || email;
  const avatarColor = getAvatarColor(email);

  const handleSignOut = async () => {
    try {
      await signOut();
      queryClient.clear();
      try {
        localStorage.removeItem("shopmate_dashboard_mode");
        localStorage.removeItem("shopmate_sidebar_collapsed");
      } catch {}
      toast.success("Signed out successfully");
      navigate("/login", { replace: true });
    } catch {
      toast.error("Sign out failed");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white text-xs font-semibold hover:opacity-90 transition-opacity`}>
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {/* User info header */}
        <div className="px-3 py-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-white text-sm font-semibold shrink-0`}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{email}</p>
            </div>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/settings")} className="gap-2 cursor-pointer">
          <Settings className="w-4 h-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/security/roles")} className="gap-2 cursor-pointer">
          <Shield className="w-4 h-4" />
          Roles & Permissions
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="w-4 h-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
