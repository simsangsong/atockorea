/**
 * U0.2 — the tour room's icon vocabulary (U-D3: no emoji in UI chrome).
 *
 * One semantic name per job, all lucide. Components import from here, not
 * from lucide-react directly, so the room's icon language stays consistent
 * and swappable in one place. Emoji remain allowed only inside message
 * CONTENT (e.g. quick-reply preset text that actually gets sent).
 */

export {
  // Shell & navigation
  House as IconTabHome,
  MoreHorizontal as IconMore,
  PencilLine as IconPlanEdit,
  MessageCircle as IconTabChat,

  // Home dashboard tiles (H2.1 — launcher glyphs, one per grid slot)
  MessagesSquare as IconTileChat,
  CalendarClock as IconTileSchedule,
  MapPinned as IconTileMap,
  BusFront as IconTilePickup,
  Siren as IconTileSos,
  Map as IconTabMap,
  CalendarDays as IconTabSchedule,
  Settings as IconTabSettings,
  ShieldAlert as IconEmergency,
  ChevronDown as IconScrollDown,
  ChevronRight as IconChevronRight,
  X as IconClose,
  Compass as IconLost,

  // Composer
  Plus as IconAttach,
  Mic as IconMic,
  Camera as IconCamera,
  ArrowUp as IconSend,
  Check as IconDone,
  Search as IconAsk,

  // Bubbles & meta
  Globe as IconTranslated,
  Undo2 as IconOriginal,
  Clock as IconSending,
  RotateCcw as IconRetry,
  Volume2 as IconListen,
  ShieldCheck as IconOpsBadge,
  Flag as IconGuide,
  User as IconTraveller,

  // Cards & banners
  Clock as IconHours,
  Toilet as IconRestroom,
  VolumeX as IconMuted,
  Mail as IconMail,
  MapPin as IconArrived,
  Sparkles as IconHighlight,
  Megaphone as IconMeeting,
  Hourglass as IconFreeTime,
  Bus as IconPickup,
  CalendarDays as IconDate,
  Phone as IconPhone,
  Play as IconPlay,
  Pause as IconPause,
  AudioLines as IconCaption,
  Flag as IconEnded,
  Download as IconInstall,
  ExternalLink as IconOpenExternal,
  Navigation as IconFollow,
  LocateFixed as IconMyLocation,
  Ticket as IconAdmission,
  Footprints as IconWalking,
  Ban as IconClosedDay,
  SquareParking as IconParking,
  Store as IconFacility,
  Lightbulb as IconTip,
  ImageIcon as IconPhotoNote,
  Sun as IconThemeLight,
  Moon as IconThemeDark,
  MonitorSmartphone as IconThemeSystem,
  Languages as IconLanguage,
  Type as IconTextSize,
  Zap as IconQuickReply,
  Timer as IconEta,
  Users as IconPresence,

  // Smart Guide concierge (V2.2)
  Sparkles as IconConcierge,
  SendHorizontal as IconConciergeSend,

  // Travel timeline + review reward (V4)
  Route as IconJourney,
  Star as IconReview,
  Gift as IconReward,
} from 'lucide-react';
