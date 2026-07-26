/**
 * U0.2 — the tour room's icon vocabulary (U-D3: no emoji in UI chrome).
 *
 * One semantic name per job, all lucide. Components import from here, not
 * from lucide-react directly, so the room's icon language stays consistent
 * and swappable in one place. Emoji remain allowed only inside message
 * CONTENT (e.g. quick-reply preset text that actually gets sent) and in the
 * quick-reply chips, which preview that content (U4-D6 amendment §N).
 */

/**
 * U4-D6 — the only icon sizes allowed in tour-room chrome. The audit found
 * 254 call sites spread over 19 different px values; five steps is the whole
 * vocabulary now:
 *   meta 14   — inline glyphs beside 11–12px text (bubble meta column)
 *   chip 16   — quick-reply chips, list-row leading glyphs
 *   action 18 — standard buttons, card actions
 *   nav 22    — header buttons, tab bar, composer dock
 *   tile 26   — action-grid tiles, cockpit large targets
 */
export const TR_ICON = { meta: 14, chip: 16, action: 18, nav: 22, tile: 26 } as const;
/** Stroke pairs with size: 1.75 at ≥16px, 2 at 14px (thin strokes vanish small). */
export const TR_STROKE = { default: 1.75, small: 2 } as const;

export {
  // Shell & navigation
  House as IconTabHome,
  ChevronLeft as IconBack,
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
  Paperclip as IconPaperclip,
  Plus as IconPlus,
  FileText as IconFile,
  Mic as IconMic,
  Camera as IconCamera,
  ArrowUp as IconSend,
  Check as IconDone,
  Search as IconAsk,
  SmilePlus as IconReact,
  CornerUpLeft as IconReply,
  Copy as IconCopy,
  Trash2 as IconTrash,

  // Bubbles & meta
  Globe as IconTranslated,
  Undo2 as IconOriginal,
  Clock as IconSending,
  RotateCcw as IconRetry,
  Volume2 as IconListen,
  ShieldCheck as IconOpsBadge,
  Flag as IconGuide,
  // A1.1 P1 — the driver needs a glyph distinct from the guide's flag; the
  // van/bus reads "the person driving" at a glance in a 36px feed avatar.
  Bus as IconDriver,
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

  // U4-D6 — barrel consolidation (W0.1): every glyph the room uses, one file.
  AlarmClock as IconAlarm,
  CalendarCheck as IconEventOn,
  CalendarX as IconEventOff,
  Clapperboard as IconVideo,
  Landmark as IconLandmark,
  Utensils as IconMeal,
  ChevronUp as IconCollapse,
  ChevronUp as IconMoveUp,
  ChevronDown as IconMoveDown,
  Link2 as IconLink,
  Share2 as IconShare,
  Flag as IconReport,
  Inbox as IconInbox,
  RefreshCw as IconRefresh,
  Send as IconSubmit,
  Square as IconStop,
  Palette as IconPalette,
  QrCode as IconQr,
  StickyNote as IconNote,
  Clock3 as IconTime,
  UserRound as IconPerson,
  Crosshair as IconRecenter,
  Maximize2 as IconFitAll,

  // U4-D6 — emoji-chrome retirement glyphs (W0.2)
  CircleCheck as IconSuccess,
  Ticket as IconTicket,
  Receipt as IconReceipt,
  TriangleAlert as IconWarn,
  Salad as IconDiet,
  Accessibility as IconAccessible,
  Baby as IconInfant,
  PartyPopper as IconCheers,
  Navigation2 as IconBearing,
  Car as IconVehicle,
  Compass as IconExplore,
  ClipboardCheck as IconChecklist,
  Wallet as IconLedger,
  CircleDollarSign as IconExpense,
  UtensilsCrossed as IconDining,
  CloudSun as IconBriefing,
  ListChecks as IconSummary,
  Armchair as IconSeat,
  LayoutGrid as IconDrawer,
} from 'lucide-react';
