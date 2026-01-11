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
} from "lucide-react";
import { Button, Badge, Input, DotPattern, PageBackground } from "@/components/ui";
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
  { id: "openrouter", name: "OpenRouter", description: "Access GPT-4, Claude, Gemini and more", icon: "🌐", connected: true, apiKey: "sk-or-****************************", status: "active", lastUsed: "2 hours ago" },
  { id: "elevenlabs", name: "ElevenLabs", description: "State-of-the-art text-to-speech", icon: "🎙️", connected: true, apiKey: "el-****************************", status: "active", lastUsed: "5 hours ago" },
  { id: "fal", name: "fal.ai", description: "Fast inference for image and video", icon: "⚡", connected: true, apiKey: "fal-****************************", status: "active", lastUsed: "1 day ago" },
  { id: "replicate", name: "Replicate", description: "Run ML models in the cloud", icon: "🔄", connected: false },
  { id: "together", name: "Together AI", description: "Open-source model inference", icon: "🤝", connected: false },
  { id: "synclabs", name: "Sync Labs", description: "Lip-sync and video generation", icon: "👄", connected: true, apiKey: "sync-****************************", status: "error", lastUsed: "3 days ago" },
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

  const toggleShowApiKey = (providerId: string) => {
    setShowApiKeys((prev) => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  return (
    <PageBackground>
      {/* Header */}
      <div className="shrink-0 h-14 px-6 flex items-center border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center">
            <Settings className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Settings</h1>
            <p className="text-[11px] text-zinc-500">Configure your account</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex gap-6">
            {/* Sidebar */}
            <motion.nav initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="w-52 shrink-0">
              <div className="p-2 bg-zinc-900/50 border border-zinc-800/60 rounded-xl">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as SettingsTab)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                        isActive ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                      )}
                    >
                      <tab.icon className={cn("w-4 h-4", isActive && "text-blue-400")} />
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
                <div className="p-6 bg-zinc-900/50 border border-zinc-800/60 rounded-xl">
                  <h3 className="text-sm font-semibold text-white mb-6">Profile Information</h3>
                  <div className="flex items-start gap-6 mb-6">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
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
                      <Input defaultValue="User" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-400 mb-2 block">Email</label>
                      <Input defaultValue="user@example.com" disabled />
                    </div>
                  </div>
                  <div className="flex justify-end mt-6">
                    <Button>Save Changes</Button>
                  </div>
                </div>
              )}

              {/* Providers Tab */}
              {activeTab === "providers" && (
                <div className="space-y-4">
                  <div className="relative p-5 bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden">
                    <DotPattern className="text-blue-500/5" />
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                          <Link2 className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-medium text-white">Provider Connections</h3>
                          <p className="text-xs text-zinc-500">{providers.filter((p) => p.connected).length} of {providers.length} connected</p>
                        </div>
                      </div>
                      <Button variant="outline" leftIcon={<Plus className="w-4 h-4" />}>Add Provider</Button>
                    </div>
                  </div>

                  {providers.map((provider, i) => (
                    <motion.div key={provider.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                      <div className="p-5 bg-zinc-900/50 border border-zinc-800/60 rounded-xl">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-2xl">{provider.icon}</div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-white">{provider.name}</h4>
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
                              <p className="text-xs text-zinc-500 mb-3">{provider.description}</p>
                              {provider.connected && provider.apiKey && (
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                                    <Key className="w-3 h-3 text-zinc-500" />
                                    <code className="text-xs text-zinc-400 font-mono">
                                      {showApiKeys[provider.id] ? provider.apiKey.replace(/\*/g, "x") : provider.apiKey}
                                    </code>
                                    <button onClick={() => toggleShowApiKey(provider.id)} className="p-1 hover:bg-zinc-700 rounded">
                                      {showApiKeys[provider.id] ? <EyeOff className="w-3 h-3 text-zinc-500" /> : <Eye className="w-3 h-3 text-zinc-500" />}
                                    </button>
                                    <button className="p-1 hover:bg-zinc-700 rounded"><Copy className="w-3 h-3 text-zinc-500" /></button>
                                  </div>
                                  {provider.lastUsed && <span className="text-xs text-zinc-600">Last used {provider.lastUsed}</span>}
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

                  <div className="p-5 bg-zinc-900/50 border border-zinc-800/60 rounded-xl">
                    <h3 className="font-medium text-white mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-blue-400" /> Fallback Settings</h3>
                    <div className="space-y-3">
                      <label className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 cursor-pointer">
                        <div>
                          <p className="text-sm text-white">Enable automatic fallback</p>
                          <p className="text-xs text-zinc-500">Try next provider on failure</p>
                        </div>
                        <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                      </label>
                      <label className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 cursor-pointer">
                        <div>
                          <p className="text-sm text-white">Retry on rate limit</p>
                          <p className="text-xs text-zinc-500">Wait and retry when rate limited</p>
                        </div>
                        <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === "notifications" && (
                <div className="p-6 bg-zinc-900/50 border border-zinc-800/60 rounded-xl">
                  <h3 className="text-sm font-semibold text-white mb-6">Notification Preferences</h3>
                  <div className="space-y-3">
                    {[
                      { title: "Workflow completed", desc: "Get notified when a workflow finishes", default: true },
                      { title: "Workflow failed", desc: "Get notified when a workflow fails", default: true },
                      { title: "Credits low", desc: "Alert when credits fall below 20%", default: true },
                      { title: "Weekly summary", desc: "Receive weekly usage summary", default: false },
                    ].map((item) => (
                      <label key={item.title} className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50 cursor-pointer hover:border-zinc-600/50">
                        <div>
                          <p className="text-sm text-white">{item.title}</p>
                          <p className="text-xs text-zinc-500">{item.desc}</p>
                        </div>
                        <input type="checkbox" defaultChecked={item.default} className="w-4 h-4 rounded" />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === "security" && (
                <div className="p-6 bg-zinc-900/50 border border-zinc-800/60 rounded-xl">
                  <h3 className="text-sm font-semibold text-white mb-6">Security Settings</h3>
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm text-white">Two-Factor Authentication</p>
                          <p className="text-xs text-zinc-500">Add an extra layer of security</p>
                        </div>
                        <Badge variant="success">Enabled</Badge>
                      </div>
                      <Button variant="outline" size="sm">Manage 2FA</Button>
                    </div>
                    <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm text-white">Password</p>
                          <p className="text-xs text-zinc-500">Last changed 3 months ago</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Change Password</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Appearance Tab */}
              {activeTab === "appearance" && (
                <div className="p-6 bg-zinc-900/50 border border-zinc-800/60 rounded-xl">
                  <h3 className="text-sm font-semibold text-white mb-6">Theme</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {[{ name: "Dark", active: true }, { name: "Light", active: false }, { name: "System", active: false }].map((theme) => (
                      <button
                        key={theme.name}
                        className={cn(
                          "p-4 rounded-xl border text-center transition-all",
                          theme.active ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:border-zinc-600"
                        )}
                      >
                        <span className="text-sm font-medium">{theme.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </PageBackground>
  );
}
