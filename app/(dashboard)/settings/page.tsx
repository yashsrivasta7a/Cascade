"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import {
 User,
 Settings,
 Key,
 Bell,
 Shield,
 Palette,
 Link2,
 CheckCircle2,
 AlertCircle,
 Eye,
 EyeOff,
 Copy,
 Plus,
 Trash2,
 RefreshCw,
 Zap,
 Sun,
 Moon,
 Monitor,
 Camera,
 Loader2,
 Code,
 Clock,
} from "lucide-react";
import { Button, Badge, Input, DotPattern, PageBackground } from "@/components/ui";
import { UserMenu } from "@/components/layout";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SettingsTab = "profile" | "providers" | "notifications" | "security" | "appearance";

interface Provider {
 id: string;
 name: string;
 description: string;
 icon: string;
 connected: boolean;
 apiKey?: string;
 status?: "active" | "error" | "rate_limited";
 lastUsed?: string;
}

const providers: Provider[] = [
 { id: "openrouter", name: "OpenRouter", description: "Access GPT-4, Claude, Gemini and more", icon: "🌐", connected: true, apiKey: "sk-or-****************************", status: "active", lastUsed: "2 hours ago" },
 { id: "elevenlabs", name: "ElevenLabs", description: "State-of-the-art text-to-speech", icon: "🎙️", connected: true, apiKey: "el-****************************", status: "active", lastUsed: "5 hours ago" },
 { id: "fal", name: "fal.ai", description: "Fast inference for image and video", icon: "⚡", connected: true, apiKey: "fal-****************************", status: "active", lastUsed: "1 day ago" },
 { id: "replicate", name: "Replicate", description: "Run ML models in the cloud", icon: "🔄", connected: false },
 { id: "together", name: "Together AI", description: "Open-source model inference", icon: "🤝", connected: false },
 { id: "synclabs", name: "Sync Labs", description: "Lip-sync and video generation", icon: "👄", connected: true, apiKey: "sync-****************************", status: "error", lastUsed: "3 days ago" },
];

const tabs = [
 { id: "profile", label: "Profile", icon: User },
 { id: "api-keys", label: "API Keys", icon: Code },
 { id: "providers", label: "Providers", icon: Key },
 { id: "notifications", label: "Notifications", icon: Bell },
 { id: "security", label: "Security", icon: Shield },
 { id: "appearance", label: "Appearance", icon: Palette },
];

// Component that uses useSearchParams - must be wrapped in Suspense
function SettingsContent() {
 const searchParams = useSearchParams();
 const tabParam = searchParams.get("tab");
 const [activeTab, setActiveTab] = useState<SettingsTab>(
 (tabParam as SettingsTab) || "profile"
 );
 const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
 const { user } = useUser();
 const { theme, setTheme, resolvedTheme } = useTheme();
 const [mounted, setMounted] = useState(false);
 const [isUploadingImage, setIsUploadingImage] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);
 
 // API Keys state
 const [apiKeys, setApiKeys] = useState<Array<{
 id: string;
 name: string;
 prefix: string;
 lastUsedAt: string | null;
 usageCount: number;
 expiresAt: string | null;
 createdAt: string;
 }>>([]);
 const [isLoadingApiKeys, setIsLoadingApiKeys] = useState(false);
 const [isCreatingApiKey, setIsCreatingApiKey] = useState(false);
 const [newKeyName, setNewKeyName] = useState("");
 const [newKeyExpiry, setNewKeyExpiry] = useState<"never" | "30d" | "90d" | "1y">("never");
 const [showCreateKeyModal, setShowCreateKeyModal] = useState(false);
 const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
 const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

 useEffect(() => {
 setMounted(true);
 }, []);

 useEffect(() => {
 if (tabParam && tabs.some(t => t.id === tabParam)) {
 setActiveTab(tabParam as SettingsTab);
 }
 }, [tabParam]);

 // Fetch API keys when tab changes to api-keys
 useEffect(() => {
 if (activeTab === "api-keys") {
 fetchApiKeys();
 }
 }, [activeTab]);

 const fetchApiKeys = async () => {
 setIsLoadingApiKeys(true);
 try {
 const response = await fetch("/api/api-keys");
 if (response.ok) {
 const data = await response.json();
 setApiKeys(data.apiKeys);
 } else {
 toast.error("Failed to fetch API keys");
 }
 } catch (error) {
 console.error("Failed to fetch API keys:", error);
 toast.error("Failed to fetch API keys");
 } finally {
 setIsLoadingApiKeys(false);
 }
 };

 const createApiKey = async () => {
 if (!newKeyName.trim()) {
 toast.error("Please enter a name for the API key");
 return;
 }

 setIsCreatingApiKey(true);
 try {
 const response = await fetch("/api/api-keys", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ name: newKeyName, expiresIn: newKeyExpiry }),
 });

 if (response.ok) {
 const data = await response.json();
 setNewlyCreatedKey(data.apiKey.key);
 setApiKeys((prev) => [{
 id: data.apiKey.id,
 name: data.apiKey.name,
 prefix: data.apiKey.prefix,
 lastUsedAt: null,
 usageCount: 0,
 expiresAt: data.apiKey.expiresAt,
 createdAt: data.apiKey.createdAt,
 }, ...prev]);
 setNewKeyName("");
 setNewKeyExpiry("never");
 toast.success("API key created successfully");
 } else {
 const error = await response.json();
 toast.error(error.error || "Failed to create API key");
 }
 } catch (error) {
 console.error("Failed to create API key:", error);
 toast.error("Failed to create API key");
 } finally {
 setIsCreatingApiKey(false);
 }
 };

 const revokeApiKey = async (keyId: string) => {
 try {
 const response = await fetch(`/api/api-keys/${keyId}`, {
 method: "DELETE",
 });

 if (response.ok) {
 setApiKeys((prev) => prev.filter((key) => key.id !== keyId));
 toast.success("API key revoked");
 } else {
 toast.error("Failed to revoke API key");
 }
 } catch (error) {
 console.error("Failed to revoke API key:", error);
 toast.error("Failed to revoke API key");
 }
 };

 const copyToClipboard = async (text: string, keyId?: string) => {
 try {
 await navigator.clipboard.writeText(text);
 if (keyId) {
 setCopiedKeyId(keyId);
 setTimeout(() => setCopiedKeyId(null), 2000);
 }
 toast.success("Copied to clipboard");
 } catch (error) {
 toast.error("Failed to copy");
 }
 };

 const formatDate = (dateString: string | null) => {
 if (!dateString) return "Never";
 return new Date(dateString).toLocaleDateString("en-US", {
 month: "short",
 day: "numeric",
 year: "numeric",
 });
 };

 const toggleShowApiKey = (providerId: string) => {
 setShowApiKeys((prev) => ({ ...prev, [providerId]: !prev[providerId] }));
 };

 const currentTheme = mounted ? theme : "dark";

 const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file || !user) return;

 // Validate file
 if (!file.type.startsWith("image/")) {
 toast.error("Please upload an image file");
 return;
 }

 if (file.size > 10 * 1024 * 1024) {
 toast.error("Image must be smaller than 10MB");
 return;
 }

 setIsUploadingImage(true);
 try {
 await user.setProfileImage({ file });
 toast.success("Profile image updated successfully");
 } catch (error) {
 console.error("Failed to upload image:", error);
 toast.error("Failed to update profile image");
 } finally {
 setIsUploadingImage(false);
 }
 };

 const handleRemoveImage = async () => {
 if (!user) return;
 
 setIsUploadingImage(true);
 try {
 await user.setProfileImage({ file: null });
 toast.success("Profile image removed");
 } catch (error) {
 console.error("Failed to remove image:", error);
 toast.error("Failed to remove profile image");
 } finally {
 setIsUploadingImage(false);
 }
 };

 return (
 <>
 {/* Header */}
 <div className="shrink-0 min-h-14 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#6b6b6b] dark:border-zinc-800/60">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-violet-200 dark:bg-zinc-800/50 flex items-center justify-center">
 <Settings className="w-4 h-4 text-violet-600 dark:text-zinc-400" />
 </div>
 <div>
 <h1 className="text-sm font-semibold text-slate-900 dark:text-white">Settings</h1>
 <p className="text-[11px] text-slate-700 dark:text-zinc-500">Configure your account</p>
 </div>
 </div>
 <UserMenu />
 </div>

 <div className="flex-1 overflow-auto p-4 sm:p-6">
 <div className="max-w-5xl mx-auto">
 <div className="flex flex-col md:flex-row gap-6">
 {/* Sidebar */}
 <motion.nav initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="w-full md:w-52 shrink-0">
 <div className="p-2 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl flex md:block overflow-x-auto scrollbar-none">
 {tabs.map((tab) => {
 const isActive = activeTab === tab.id;
 return (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id as SettingsTab)}
 className={cn(
 "w-full shrink-0 md:shrink flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all whitespace-nowrap",
 isActive 
 ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white" 
 : "text-slate-700 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-slate-700 hover:bg-white/60 dark:hover:bg-zinc-800/50"
 )}
 >
 <tab.icon className={cn("w-4 h-4", isActive && "text-blue-500 dark:text-blue-400")} />
 {tab.label}
 </button>
 );
 })}
 </div>
 </motion.nav>

 {/* Content */}
 <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 space-y-6">
 {/* Profile Tab */}
 {activeTab === "profile" && (
 <div className="p-6 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl">
 <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-6">Profile Information</h3>
 
 {/* Avatar Section */}
 <div className="flex items-start gap-6 mb-6">
 <div className="relative group">
 <div className="w-24 h-24 rounded-2xl overflow-hidden ring-4 ring-gray-100 dark:ring-zinc-800 shadow-lg">
 {user?.imageUrl ? (
 <img
 src={user.imageUrl}
 alt={user.fullName || "User"}
 className="w-full h-full object-cover"
 />
 ) : (
 <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
 <span className="text-3xl font-bold text-white">
 {user?.firstName?.[0] || "U"}
 </span>
 </div>
 )}
 {isUploadingImage && (
 <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
 <Loader2 className="w-6 h-6 text-white animate-spin" />
 </div>
 )}
 </div>
 {/* Hover overlay */}
 <button
 onClick={() => fileInputRef.current?.click()}
 disabled={isUploadingImage}
 className="absolute inset-0 bg-black/0 hover:bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
 >
 <Camera className="w-6 h-6 text-white" />
 </button>
 </div>
 <div className="flex-1">
 <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">Profile Photo</p>
 <p className="text-xs text-slate-700 dark:text-zinc-400 mb-3">
 JPG, PNG or GIF. Max 10MB.
 </p>
 <div className="flex items-center gap-2">
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 onChange={handleImageUpload}
 className="hidden"
 />
 <Button 
 variant="outline" 
 size="sm" 
 onClick={() => fileInputRef.current?.click()}
 disabled={isUploadingImage}
 >
 {isUploadingImage ? (
 <>
 <Loader2 className="w-3 h-3 mr-2 animate-spin" />
 Uploading...
 </>
 ) : (
 "Change Photo"
 )}
 </Button>
 {user?.imageUrl && (
 <Button 
 variant="ghost" 
 size="sm"
 onClick={handleRemoveImage}
 disabled={isUploadingImage}
 className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
 >
 Remove
 </Button>
 )}
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <label className="text-xs font-medium text-slate-700 dark:text-zinc-400 mb-2 block">First Name</label>
 <Input defaultValue={user?.firstName || ""} placeholder="First name" />
 </div>
 <div>
 <label className="text-xs font-medium text-slate-700 dark:text-zinc-400 mb-2 block">Last Name</label>
 <Input defaultValue={user?.lastName || ""} placeholder="Last name" />
 </div>
 <div className="col-span-2">
 <label className="text-xs font-medium text-slate-700 dark:text-zinc-400 mb-2 block">Email</label>
 <Input defaultValue={user?.primaryEmailAddress?.emailAddress || ""} disabled />
 <p className="text-xs text-slate-800 dark:text-zinc-600 mt-1">Email is managed by your authentication provider</p>
 </div>
 </div>
 <div className="flex justify-end mt-6 pt-4 border-t border-[#6b6b6b] dark:border-zinc-800">
 <Button>Save Changes</Button>
 </div>
 </div>
 )}

 {/* API Keys Tab */}
 {activeTab === "api-keys" && (
 <div className="space-y-4">
 {/* Header Card */}
 <div className="relative p-5 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl overflow-hidden">
 <DotPattern className="text-blue-500/5" />
 <div className="relative flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-xl bg-violet-200 dark:bg-violet-500/10 border border-violet-300 dark:border-violet-500/20 flex items-center justify-center">
 <Code className="w-6 h-6 text-violet-600 dark:text-violet-400" />
 </div>
 <div>
 <h3 className="font-medium text-slate-900 dark:text-white">API Keys</h3>
 <p className="text-xs text-slate-700 dark:text-zinc-500">
 {apiKeys.length} active key{apiKeys.length !== 1 ? "s" : ""}
 </p>
 </div>
 </div>
 <Button 
 leftIcon={<Plus className="w-4 h-4" />}
 onClick={() => setShowCreateKeyModal(true)}
 >
 Create Key
 </Button>
 </div>
 </div>

 {/* Create Key Modal */}
 {showCreateKeyModal && (
 <div className="p-5 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl">
 <h4 className="font-medium text-slate-900 dark:text-white mb-4">Create New API Key</h4>
 
 {newlyCreatedKey ? (
 <div className="space-y-4">
 <div className="p-4 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20">
 <div className="flex items-center gap-2 mb-2">
 <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
 <p className="text-sm font-medium text-green-700 dark:text-green-300">API Key Created</p>
 </div>
 <p className="text-xs text-green-600 dark:text-green-400 mb-3">
 Copy this key now. You won&apos;t be able to see it again!
 </p>
 <div className="flex items-center gap-2">
 <code className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-green-200 dark:border-zinc-700 text-sm font-mono text-slate-900 dark:text-white break-all">
 {newlyCreatedKey}
 </code>
 <Button 
 variant="outline" 
 size="sm"
 onClick={() => copyToClipboard(newlyCreatedKey)}
 >
 <Copy className="w-4 h-4" />
 </Button>
 </div>
 </div>
 <div className="flex justify-end">
 <Button 
 variant="outline"
 onClick={() => {
 setShowCreateKeyModal(false);
 setNewlyCreatedKey(null);
 }}
 >
 Done
 </Button>
 </div>
 </div>
 ) : (
 <div className="space-y-4">
 <div>
 <label className="text-xs font-medium text-slate-700 dark:text-zinc-400 mb-2 block">Key Name</label>
 <Input 
 value={newKeyName}
 onChange={(e) => setNewKeyName(e.target.value)}
 placeholder="e.g., Production, Development, CI/CD"
 />
 </div>
 <div>
 <label className="text-xs font-medium text-slate-700 dark:text-zinc-400 mb-2 block">Expiration</label>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
 {[
 { value: "never", label: "Never" },
 { value: "30d", label: "30 days" },
 { value: "90d", label: "90 days" },
 { value: "1y", label: "1 year" },
 ].map((option) => (
 <button
 key={option.value}
 onClick={() => setNewKeyExpiry(option.value as typeof newKeyExpiry)}
 className={cn(
 "px-3 py-2 rounded-lg text-sm transition-all border",
 newKeyExpiry === option.value
 ? "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300"
 : "bg-white dark:bg-zinc-800/50 border-blue-100 dark:border-zinc-700 text-slate-800 dark:text-zinc-400 hover:border-gray-300 dark:hover:border-zinc-600"
 )}
 >
 {option.label}
 </button>
 ))}
 </div>
 </div>
 <div className="flex justify-end gap-2 pt-2">
 <Button 
 variant="ghost"
 onClick={() => {
 setShowCreateKeyModal(false);
 setNewKeyName("");
 setNewKeyExpiry("never");
 }}
 >
 Cancel
 </Button>
 <Button 
 onClick={createApiKey}
 disabled={isCreatingApiKey || !newKeyName.trim()}
 >
 {isCreatingApiKey ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Creating...
 </>
 ) : (
 "Create Key"
 )}
 </Button>
 </div>
 </div>
 )}
 </div>
 )}

 {/* API Keys List */}
 {isLoadingApiKeys ? (
 <div className="p-8 flex items-center justify-center">
 <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
 </div>
 ) : apiKeys.length === 0 ? (
 <div className="p-8 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl text-center">
 <Code className="w-12 h-12 mx-auto mb-4 text-slate-600 dark:text-zinc-600" />
 <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">No API Keys</h4>
 <p className="text-xs text-slate-700 dark:text-zinc-500 mb-4">
 Create an API key to authenticate with the Cascade API.
 </p>
 <Button 
 variant="outline" 
 size="sm"
 leftIcon={<Plus className="w-4 h-4" />}
 onClick={() => setShowCreateKeyModal(true)}
 >
 Create Your First Key
 </Button>
 </div>
 ) : (
 apiKeys.map((key, i) => (
 <motion.div
 key={key.id}
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: i * 0.03 }}
 >
 <div className="p-5 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl">
 <div className="flex items-start justify-between">
 <div className="flex items-start gap-4">
 <div className="w-10 h-10 rounded-lg bg-white dark:bg-zinc-800 flex items-center justify-center">
 <Key className="w-5 h-5 text-slate-700 dark:text-zinc-400" />
 </div>
 <div>
 <div className="flex items-center gap-2 mb-1">
 <h4 className="font-medium text-slate-900 dark:text-white">{key.name}</h4>
 <Badge variant="success">Active</Badge>
 </div>
 <div className="flex items-center gap-2 mb-2">
 <code className="px-2 py-1 rounded bg-white dark:bg-zinc-800 text-xs font-mono text-slate-800 dark:text-zinc-400">
 {key.prefix}••••••••••••
 </code>
 <button
 onClick={() => copyToClipboard(key.prefix + "••••••••••••", key.id)}
 className="p-1 hover:bg-white/70 dark:hover:bg-zinc-800 rounded transition-colors"
 >
 {copiedKeyId === key.id ? (
 <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
 ) : (
 <Copy className="w-3.5 h-3.5 text-slate-800 dark:text-zinc-500" />
 )}
 </button>
 </div>
 <div className="flex items-center gap-4 text-xs text-slate-700 dark:text-zinc-500">
 <span className="flex items-center gap-1">
 <Clock className="w-3 h-3" />
 Created {formatDate(key.createdAt)}
 </span>
 {key.lastUsedAt && (
 <span>Last used {formatDate(key.lastUsedAt)}</span>
 )}
 {key.usageCount > 0 && (
 <span>{key.usageCount.toLocaleString()} requests</span>
 )}
 {key.expiresAt && (
 <span className="text-amber-600 dark:text-amber-400">
 Expires {formatDate(key.expiresAt)}
 </span>
 )}
 </div>
 </div>
 </div>
 <Button 
 variant="ghost" 
 size="sm" 
 className="text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
 onClick={() => revokeApiKey(key.id)}
 >
 <Trash2 className="w-4 h-4" />
 </Button>
 </div>
 </div>
 </motion.div>
 ))
 )}

 </div>
 )}

 {/* Providers Tab */}
 {activeTab === "providers" && (
 <div className="space-y-4">
 <div className="relative p-5 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl overflow-hidden">
 <DotPattern className="text-blue-500/5" />
 <div className="relative flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-xl bg-blue-200 dark:bg-blue-500/10 border border-blue-300 dark:border-blue-500/20 flex items-center justify-center">
 <Link2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
 </div>
 <div>
 <h3 className="font-medium text-slate-900 dark:text-white">Provider Connections</h3>
 <p className="text-xs text-slate-700 dark:text-zinc-500">{providers.filter((p) => p.connected).length} of {providers.length} connected</p>
 </div>
 </div>
 <Button variant="outline" leftIcon={<Plus className="w-4 h-4" />}>Add Provider</Button>
 </div>
 </div>

 {providers.map((provider, i) => (
 <motion.div key={provider.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
 <div className="p-5 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl">
 <div className="flex items-start justify-between">
 <div className="flex items-start gap-4">
 <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center text-2xl">{provider.icon}</div>
 <div>
 <div className="flex items-center gap-2 mb-1">
 <h4 className="font-medium text-slate-900 dark:text-white">{provider.name}</h4>
 {provider.connected ? (
 <Badge variant={provider.status === "active" ? "success" : "error"}>
 {provider.status === "active" && <CheckCircle2 className="w-3 h-3" />}
 {provider.status === "error" && <AlertCircle className="w-3 h-3" />}
 {provider.status === "active" ? "Connected" : "Error"}
 </Badge>
 ) : (
 <Badge variant="default">Not Connected</Badge>
 )}
 </div>
 <p className="text-xs text-slate-700 dark:text-zinc-500 mb-3">{provider.description}</p>
 {provider.connected && provider.apiKey && (
 <div className="flex items-center gap-2">
 <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800/50 border border-[#6b6b6b] dark:border-zinc-700/50">
 <Key className="w-3 h-3 text-slate-800 dark:text-zinc-500" />
 <code className="text-xs text-slate-800 dark:text-zinc-400 font-mono">
 {showApiKeys[provider.id] ? provider.apiKey.replace(/\*/g, "x") : provider.apiKey}
 </code>
 <button onClick={() => toggleShowApiKey(provider.id)} className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded">
 {showApiKeys[provider.id] ? <EyeOff className="w-3 h-3 text-slate-800 dark:text-zinc-500" /> : <Eye className="w-3 h-3 text-slate-800 dark:text-zinc-500" />}
 </button>
 <button className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded"><Copy className="w-3 h-3 text-slate-800 dark:text-zinc-500" /></button>
 </div>
 {provider.lastUsed && <span className="text-xs text-slate-800 dark:text-zinc-600">Last used {provider.lastUsed}</span>}
 </div>
 )}
 </div>
 </div>
 <div className="flex items-center gap-2">
 {provider.connected ? (
 <>
 <Button variant="ghost" size="sm" leftIcon={<RefreshCw className="w-4 h-4" />}>Test</Button>
 <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></Button>
 </>
 ) : (
 <Button size="sm" leftIcon={<Plus className="w-4 h-4" />}>Connect</Button>
 )}
 </div>
 </div>
 {provider.status === "error" && (
 <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
 <p className="text-xs text-red-400">Connection error: API key is invalid or expired.</p>
 </div>
 )}
 </div>
 </motion.div>
 ))}

 <div className="p-5 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl">
 <h3 className="font-medium text-slate-900 dark:text-white mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Fallback Settings</h3>
 <div className="space-y-3">
 <label className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-zinc-800/50 border border-[#6b6b6b] dark:border-zinc-700/50 cursor-pointer">
 <div>
 <p className="text-sm text-slate-900 dark:text-white">Enable automatic fallback</p>
 <p className="text-xs text-slate-700 dark:text-zinc-500">Try next provider on failure</p>
 </div>
 <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
 </label>
 <label className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-zinc-800/50 border border-[#6b6b6b] dark:border-zinc-700/50 cursor-pointer">
 <div>
 <p className="text-sm text-slate-900 dark:text-white">Retry on rate limit</p>
 <p className="text-xs text-slate-700 dark:text-zinc-500">Wait and retry when rate limited</p>
 </div>
 <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
 </label>
 </div>
 </div>
 </div>
 )}

 {/* Notifications Tab */}
 {activeTab === "notifications" && (
 <div className="p-6 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl">
 <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-6">Notification Preferences</h3>
 <div className="space-y-3">
 {[
 { title: "Workflow completed", desc: "Get notified when a workflow finishes", default: true },
 { title: "Workflow failed", desc: "Get notified when a workflow fails", default: true },
 { title: "Credits low", desc: "Alert when credits fall below 20%", default: true },
 { title: "Weekly summary", desc: "Receive weekly usage summary", default: false },
 ].map((item) => (
 <label key={item.title} className="flex items-center justify-between p-4 rounded-lg bg-white dark:bg-zinc-800/50 border border-[#6b6b6b] dark:border-zinc-700/50 cursor-pointer hover:border-gray-300 dark:hover:border-zinc-600/50">
 <div>
 <p className="text-sm text-slate-900 dark:text-white">{item.title}</p>
 <p className="text-xs text-slate-700 dark:text-zinc-500">{item.desc}</p>
 </div>
 <input type="checkbox" defaultChecked={item.default} className="w-4 h-4 rounded" />
 </label>
 ))}
 </div>
 </div>
 )}

 {/* Security Tab */}
 {activeTab === "security" && (
 <div className="p-6 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl">
 <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-6">Security Settings</h3>
 <div className="space-y-4">
 <div className="p-4 rounded-lg bg-white dark:bg-zinc-800/50 border border-[#6b6b6b] dark:border-zinc-700/50">
 <div className="flex items-center justify-between mb-3">
 <div>
 <p className="text-sm text-slate-900 dark:text-white">Two-Factor Authentication</p>
 <p className="text-xs text-slate-700 dark:text-zinc-500">Add an extra layer of security</p>
 </div>
 <Badge variant="success">Enabled</Badge>
 </div>
 <Button variant="outline" size="sm">Manage 2FA</Button>
 </div>
 <div className="p-4 rounded-lg bg-white dark:bg-zinc-800/50 border border-[#6b6b6b] dark:border-zinc-700/50">
 <div className="flex items-center justify-between mb-3">
 <div>
 <p className="text-sm text-slate-900 dark:text-white">Password</p>
 <p className="text-xs text-slate-700 dark:text-zinc-500">Last changed 3 months ago</p>
 </div>
 </div>
 <Button variant="outline" size="sm">Change Password</Button>
 </div>
 </div>
 </div>
 )}

 {/* Appearance Tab */}
 {activeTab === "appearance" && (
 <div className="p-6 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl">
 <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-6">Theme</h3>
 <p className="text-sm text-slate-700 dark:text-zinc-400 mb-4">
 Choose how Cascade looks for you. Select a theme or sync with your system settings.
 </p>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 {[
 { id: "light", name: "Light", icon: Sun, preview: "bg-white border-blue-100" },
 { id: "dark", name: "Dark", icon: Moon, preview: "bg-zinc-900 border-zinc-700" },
 { id: "system", name: "System", icon: Monitor, preview: "bg-gradient-to-r from-white to-zinc-900 border-gray-300" },
 ].map((themeOption) => {
 const isActive = mounted && currentTheme === themeOption.id;
 const Icon = themeOption.icon;
 return (
 <button
 key={themeOption.id}
 onClick={() => setTheme(themeOption.id)}
 className={cn(
 "relative p-4 rounded-xl border-2 text-center transition-all group",
 isActive
 ? "border-blue-500 bg-blue-500/5"
 : "border-blue-100 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600 bg-white dark:bg-zinc-800/50"
 )}
 >
 {/* Preview Box */}
 <div className={cn(
 "w-full h-16 rounded-lg mb-3 border",
 themeOption.preview
 )} />
 <div className="flex items-center justify-center gap-2">
 <Icon className={cn(
 "w-4 h-4",
 isActive ? "text-blue-500" : "text-slate-800 dark:text-zinc-500"
 )} />
 <span className={cn(
 "text-sm font-medium",
 isActive ? "text-blue-500" : "text-slate-800 dark:text-zinc-400"
 )}>
 {themeOption.name}
 </span>
 </div>
 {isActive && (
 <div className="absolute top-2 right-2">
 <CheckCircle2 className="w-5 h-5 text-blue-500" />
 </div>
 )}
 </button>
 );
 })}
 </div>
 <p className="text-xs text-slate-800 dark:text-zinc-600 mt-4">
 {mounted && currentTheme === "system" 
 ? `Currently using ${resolvedTheme} mode based on your system preferences.`
 : `You're using ${currentTheme} mode.`
 }
 </p>
 </div>
 )}
 </motion.div>
 </div>
 </div>
 </div>
 </>
 );
}

// Loading fallback for Suspense
function SettingsLoading() {
 return (
 <div className="flex items-center justify-center h-full">
 <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
 </div>
 );
}

// Main page component with Suspense boundary
export default function SettingsPage() {
 return (
 <PageBackground>
 <Suspense fallback={<SettingsLoading />}>
 <SettingsContent />
 </Suspense>
 </PageBackground>
 );
}
