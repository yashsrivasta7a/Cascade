"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  User,
  Settings,
  Key,
  Bell,
  Shield,
  Palette,
  Globe,
  Link2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Eye,
  EyeOff,
  Copy,
  Plus,
  Trash2,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Button, Card, Badge, Input } from "@/components/ui";
import { Header } from "@/components/layout";
import { cn } from "@/lib/utils";

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
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Access GPT-4, Claude, Gemini and more via one API",
    icon: "🌐",
    connected: true,
    apiKey: "sk-or-****************************",
    status: "active",
    lastUsed: "2 hours ago",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    description: "State-of-the-art text-to-speech synthesis",
    icon: "🎙️",
    connected: true,
    apiKey: "el-****************************",
    status: "active",
    lastUsed: "5 hours ago",
  },
  {
    id: "fal",
    name: "fal.ai",
    description: "Fast inference for image and video models",
    icon: "⚡",
    connected: true,
    apiKey: "fal-****************************",
    status: "active",
    lastUsed: "1 day ago",
  },
  {
    id: "replicate",
    name: "Replicate",
    description: "Run ML models in the cloud",
    icon: "🔄",
    connected: false,
  },
  {
    id: "together",
    name: "Together AI",
    description: "Open-source model inference",
    icon: "🤝",
    connected: false,
  },
  {
    id: "synclabs",
    name: "Sync Labs",
    description: "Lip-sync and video generation",
    icon: "👄",
    connected: true,
    apiKey: "sync-****************************",
    status: "error",
    lastUsed: "3 days ago",
  },
];

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "providers", label: "Providers", icon: Key },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "appearance", label: "Appearance", icon: Palette },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("providers");
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [editingProvider, setEditingProvider] = useState<string | null>(null);

  const toggleShowApiKey = (providerId: string) => {
    setShowApiKeys((prev) => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  return (
    <div className="h-full flex flex-col">
      <Header
        title="Settings"
        description="Configure your account and preferences"
      />

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex gap-8">
            {/* Sidebar */}
            <motion.nav
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="w-56 flex-shrink-0"
            >
              <Card variant="default" className="p-2">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as SettingsTab)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all",
                        isActive
                          ? "bg-white/5 text-white"
                          : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
                      )}
                    >
                      <tab.icon
                        className={cn(
                          "w-4 h-4",
                          isActive ? "text-cyan-400" : ""
                        )}
                      />
                      {tab.label}
                    </button>
                  );
                })}
              </Card>
            </motion.nav>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1"
            >
              {/* Profile Tab */}
              {activeTab === "profile" && (
                <div className="space-y-6">
                  <Card variant="elevated" className="p-6">
                    <h3 className="text-lg font-semibold text-zinc-100 mb-6">Profile Information</h3>
                    <div className="flex items-start gap-6 mb-6">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                        <span className="text-2xl font-bold text-white">U</span>
                      </div>
                      <div>
                        <Button variant="outline" size="sm">Change Avatar</Button>
                        <p className="text-xs text-zinc-500 mt-2">JPG, PNG or GIF. Max 2MB.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-zinc-400 mb-2 block">Full Name</label>
                        <Input defaultValue="User" className="bg-zinc-900/50" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-400 mb-2 block">Email</label>
                        <Input defaultValue="user@example.com" className="bg-zinc-900/50" disabled />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-zinc-400 mb-2 block">Bio</label>
                        <textarea
                          className="w-full px-3 py-2 rounded-xl bg-zinc-900/50 border border-white/5 text-sm text-zinc-100 focus:outline-none focus:border-cyan-500/30 resize-none h-20"
                          placeholder="Tell us about yourself..."
                        />
                      </div>
                    </div>
                    <div className="flex justify-end mt-6">
                      <Button>Save Changes</Button>
                    </div>
                  </Card>
                </div>
              )}

              {/* Providers Tab */}
              {activeTab === "providers" && (
                <div className="space-y-6">
                  {/* Connected Providers Info */}
                  <Card variant="gradient" className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                          <Link2 className="w-6 h-6 text-cyan-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-zinc-100">Provider Connections</h3>
                          <p className="text-sm text-zinc-500">
                            {providers.filter((p) => p.connected).length} of {providers.length} providers connected
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" leftIcon={<Plus className="w-4 h-4" />}>
                        Add Custom Provider
                      </Button>
                    </div>
                  </Card>

                  {/* Provider List */}
                  <div className="space-y-3">
                    {providers.map((provider, i) => (
                      <motion.div
                        key={provider.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <Card variant="elevated" className="p-5">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-2xl">
                                {provider.icon}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-zinc-100">{provider.name}</h4>
                                  {provider.connected ? (
                                    <Badge
                                      variant={
                                        provider.status === "active"
                                          ? "success"
                                          : provider.status === "error"
                                          ? "error"
                                          : "warning"
                                      }
                                    >
                                      {provider.status === "active" && <CheckCircle2 className="w-3 h-3" />}
                                      {provider.status === "error" && <AlertCircle className="w-3 h-3" />}
                                      {provider.status === "active" ? "Connected" : "Error"}
                                    </Badge>
                                  ) : (
                                    <Badge variant="default">Not Connected</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-zinc-500 mb-3">{provider.description}</p>

                                {provider.connected && provider.apiKey && (
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-white/5">
                                      <Key className="w-3 h-3 text-zinc-500" />
                                      <code className="text-xs text-zinc-400 font-mono">
                                        {showApiKeys[provider.id]
                                          ? provider.apiKey.replace(/\*/g, "x")
                                          : provider.apiKey}
                                      </code>
                                      <button
                                        onClick={() => toggleShowApiKey(provider.id)}
                                        className="p-1 hover:bg-white/5 rounded transition-colors"
                                      >
                                        {showApiKeys[provider.id] ? (
                                          <EyeOff className="w-3 h-3 text-zinc-500" />
                                        ) : (
                                          <Eye className="w-3 h-3 text-zinc-500" />
                                        )}
                                      </button>
                                      <button className="p-1 hover:bg-white/5 rounded transition-colors">
                                        <Copy className="w-3 h-3 text-zinc-500" />
                                      </button>
                                    </div>
                                    {provider.lastUsed && (
                                      <span className="text-xs text-zinc-600">
                                        Last used {provider.lastUsed}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {provider.connected ? (
                                <>
                                  <Button variant="ghost" size="sm" leftIcon={<RefreshCw className="w-4 h-4" />}>
                                    Test
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </>
                              ) : (
                                <Button size="sm" leftIcon={<Plus className="w-4 h-4" />}>
                                  Connect
                                </Button>
                              )}
                            </div>
                          </div>

                          {provider.status === "error" && (
                            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                              <p className="text-xs text-red-400">
                                Connection error: API key is invalid or expired. Please update your credentials.
                              </p>
                            </div>
                          )}
                        </Card>
                      </motion.div>
                    ))}
                  </div>

                  {/* Provider Fallback Settings */}
                  <Card variant="elevated" className="p-6">
                    <h3 className="font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-cyan-400" />
                      Provider Fallback Settings
                    </h3>
                    <p className="text-sm text-zinc-500 mb-4">
                      Configure automatic fallback behavior when a provider fails or is rate limited.
                    </p>
                    <div className="space-y-4">
                      <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-white/5 cursor-pointer hover:border-white/10 transition-colors">
                        <div>
                          <p className="text-sm text-zinc-100">Enable automatic fallback</p>
                          <p className="text-xs text-zinc-500">Automatically try next provider on failure</p>
                        </div>
                        <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                      </label>
                      <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-white/5 cursor-pointer hover:border-white/10 transition-colors">
                        <div>
                          <p className="text-sm text-zinc-100">Retry on rate limit</p>
                          <p className="text-xs text-zinc-500">Wait and retry when rate limited</p>
                        </div>
                        <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                      </label>
                      <div className="p-3 rounded-xl bg-zinc-900/50 border border-white/5">
                        <label className="text-sm text-zinc-100 mb-2 block">Max retries per provider</label>
                        <Input type="number" defaultValue={2} className="w-24 bg-zinc-800" />
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === "notifications" && (
                <div className="space-y-6">
                  <Card variant="elevated" className="p-6">
                    <h3 className="text-lg font-semibold text-zinc-100 mb-6">Notification Preferences</h3>
                    <div className="space-y-4">
                      {[
                        { title: "Workflow completed", desc: "Get notified when a workflow finishes", default: true },
                        { title: "Workflow failed", desc: "Get notified when a workflow fails", default: true },
                        { title: "Credits low", desc: "Alert when credits fall below 20%", default: true },
                        { title: "Weekly summary", desc: "Receive weekly usage summary", default: false },
                        { title: "New features", desc: "Updates about new features and improvements", default: true },
                      ].map((item) => (
                        <label key={item.title} className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/30 border border-white/5 cursor-pointer hover:border-white/10 transition-colors">
                          <div>
                            <p className="text-sm font-medium text-zinc-100">{item.title}</p>
                            <p className="text-xs text-zinc-500">{item.desc}</p>
                          </div>
                          <input type="checkbox" defaultChecked={item.default} className="w-4 h-4 rounded" />
                        </label>
                      ))}
                    </div>
                  </Card>

                  <Card variant="elevated" className="p-6">
                    <h3 className="text-lg font-semibold text-zinc-100 mb-6">Delivery Channels</h3>
                    <div className="space-y-4">
                      {[
                        { channel: "Email", icon: "📧", connected: true },
                        { channel: "Slack", icon: "💬", connected: false },
                        { channel: "Discord", icon: "🎮", connected: false },
                        { channel: "Webhook", icon: "🔗", connected: true },
                      ].map((item) => (
                        <div key={item.channel} className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/30 border border-white/5">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{item.icon}</span>
                            <span className="text-sm font-medium text-zinc-100">{item.channel}</span>
                          </div>
                          <Button variant={item.connected ? "outline" : "primary"} size="sm">
                            {item.connected ? "Configure" : "Connect"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === "security" && (
                <div className="space-y-6">
                  <Card variant="elevated" className="p-6">
                    <h3 className="text-lg font-semibold text-zinc-100 mb-6">Security Settings</h3>
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-zinc-900/30 border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-sm font-medium text-zinc-100">Two-Factor Authentication</p>
                            <p className="text-xs text-zinc-500">Add an extra layer of security</p>
                          </div>
                          <Badge variant="success">Enabled</Badge>
                        </div>
                        <Button variant="outline" size="sm">Manage 2FA</Button>
                      </div>
                      <div className="p-4 rounded-xl bg-zinc-900/30 border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-sm font-medium text-zinc-100">Password</p>
                            <p className="text-xs text-zinc-500">Last changed 3 months ago</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">Change Password</Button>
                      </div>
                      <div className="p-4 rounded-xl bg-zinc-900/30 border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-sm font-medium text-zinc-100">Active Sessions</p>
                            <p className="text-xs text-zinc-500">3 devices currently logged in</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">View Sessions</Button>
                      </div>
                    </div>
                  </Card>

                  <Card variant="elevated" className="p-6">
                    <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                      <Key className="w-5 h-5 text-amber-400" />
                      API Keys
                    </h3>
                    <p className="text-sm text-zinc-500 mb-4">
                      Manage API keys for programmatic access to your workflows.
                    </p>
                    <Button variant="outline" leftIcon={<Plus className="w-4 h-4" />}>
                      Generate New API Key
                    </Button>
                  </Card>
                </div>
              )}

              {/* Appearance Tab */}
              {activeTab === "appearance" && (
                <div className="space-y-6">
                  <Card variant="elevated" className="p-6">
                    <h3 className="text-lg font-semibold text-zinc-100 mb-6">Theme</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { name: "Dark", active: true },
                        { name: "Light", active: false },
                        { name: "System", active: false },
                      ].map((theme) => (
                        <button
                          key={theme.name}
                          className={cn(
                            "p-4 rounded-xl border text-center transition-all",
                            theme.active
                              ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                              : "bg-zinc-900/30 border-white/5 text-zinc-400 hover:border-white/10"
                          )}
                        >
                          <span className="text-sm font-medium">{theme.name}</span>
                        </button>
                      ))}
                    </div>
                  </Card>

                  <Card variant="elevated" className="p-6">
                    <h3 className="text-lg font-semibold text-zinc-100 mb-6">Canvas Preferences</h3>
                    <div className="space-y-4">
                      <label className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/30 border border-white/5">
                        <div>
                          <p className="text-sm font-medium text-zinc-100">Show grid</p>
                          <p className="text-xs text-zinc-500">Display grid on the workflow canvas</p>
                        </div>
                        <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                      </label>
                      <label className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/30 border border-white/5">
                        <div>
                          <p className="text-sm font-medium text-zinc-100">Snap to grid</p>
                          <p className="text-xs text-zinc-500">Nodes snap to grid when dragging</p>
                        </div>
                        <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                      </label>
                      <label className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/30 border border-white/5">
                        <div>
                          <p className="text-sm font-medium text-zinc-100">Animated edges</p>
                          <p className="text-xs text-zinc-500">Show flowing animation on connections</p>
                        </div>
                        <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                      </label>
                      <label className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/30 border border-white/5">
                        <div>
                          <p className="text-sm font-medium text-zinc-100">Show minimap</p>
                          <p className="text-xs text-zinc-500">Display overview minimap on canvas</p>
                        </div>
                        <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                      </label>
                    </div>
                  </Card>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
