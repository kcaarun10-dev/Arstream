import React from "react";
import { 
  Grid, 
  Trophy, 
  Globe, 
  Zap, 
  Film, 
  Gamepad2, 
  Activity, 
  CircleDot, 
  Flame, 
  Shield, 
  Disc, 
  ShieldCheck, 
  Target, 
  Sparkles, 
  Radio, 
  Tv, 
  Play, 
  Flag, 
  Layers 
} from "lucide-react";

export interface SportCategory {
  id: string;
  name: string;
  label: string;
  icon: React.ElementType;
}

export const ALL_CATEGORIES: SportCategory[] = [
  { id: "all", name: "All Streams", label: "All Streams", icon: Grid },
  { id: "football", name: "Football", label: "Football / Soccer (130m)", icon: Globe },
  { id: "cricket", name: "Cricket", label: "Cricket (All)", icon: Trophy },
  { id: "cricket_t20", name: "Cricket T20", label: "Cricket (T20 / IPL - 210m)", icon: Trophy },
  { id: "cricket_odi", name: "Cricket ODI", label: "Cricket (ODI / 50-Over - 480m)", icon: Trophy },
  { id: "cricket_test", name: "Cricket Test", label: "Cricket (Test Match - 5 Days)", icon: Trophy },
  { id: "motorsport", name: "Motorsport", label: "Motorsport (F1/MotoGP)", icon: Zap },
  { id: "basketball", name: "Basketball", label: "Basketball (NBA)", icon: Activity },
  { id: "tennis", name: "Tennis", label: "Tennis (Grand Slams)", icon: CircleDot },
  { id: "wrestling", name: "Wrestling", label: "Wrestling (WWE/AEW)", icon: Flame },
  { id: "mma", name: "MMA", label: "MMA / UFC / Boxing", icon: Shield },
  { id: "baseball", name: "Baseball", label: "Baseball (MLB)", icon: Disc },
  { id: "americanfootball", name: "NFL", label: "American Football (NFL)", icon: ShieldCheck },
  { id: "hockey", name: "Hockey", label: "Ice Hockey (NHL)", icon: Target },
  { id: "badminton", name: "Badminton", label: "Badminton (BWF)", icon: Sparkles },
  { id: "volleyball", name: "Volleyball", label: "Volleyball", icon: Radio },
  { id: "rugby", name: "Rugby", label: "Rugby", icon: Play },
  { id: "golf", name: "Golf", label: "Golf (PGA)", icon: Flag },
  { id: "tabletennis", name: "Table Tennis", label: "Table Tennis", icon: Layers },
  { id: "esports", name: "Esports", label: "Esports & Gaming", icon: Gamepad2 },
  { id: "cinema", name: "Cinema", label: "Cinema & 4K", icon: Film },
  { id: "events", name: "Live Events", label: "Special Events", icon: Tv },
  { id: "other", name: "Other", label: "Other Sports", icon: Grid },
];

export const ADMIN_CATEGORIES = ALL_CATEGORIES.filter(c => c.id !== "all");
