"use client"

import type React from "react"
import Header from "@/components/header"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase-client"
import { Upload, Trash2, Loader2, Brain } from "lucide-react"

export default function ProfilePage() {
  const { t } = useLanguage()
  const { user, isLoading, updateProfile, signOut } = useAuth()
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    }

    if (user) {
      setUsername(user.user_metadata?.username || "")
      setAvatarUrl(user.user_metadata?.avatar_url || null)
    }
  }, [user, isLoading, router])

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true)
      setError(null)

      if (!event.target.files || event.target.files.length === 0) {
        return
      }

      const file = event.target.files[0]
      const fileExt = file.name.split(".").pop()
      const filePath = `${user!.id}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`

      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError(t("Image is too large. Maximum size is 2MB."))
        return
      }

      // Check file type
      if (!["image/jpeg", "image/png", "image/gif"].includes(file.type)) {
        setError(t("Invalid file type. Please upload a JPEG, PNG, or GIF image."))
        return
      }

      const { error: uploadError, data } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        throw uploadError
      }

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath)

      setAvatarUrl(publicUrlData.publicUrl)
    } catch (error: any) {
      setError(error.message || t("Error uploading avatar"))
    } finally {
      setUploading(false)
    }
  }

  const removeAvatar = async () => {
    try {
      setUploading(true)
      setError(null)

      if (!avatarUrl) return

      // Extract file path from URL
      const urlParts = avatarUrl.split("/")
      const filePath = urlParts[urlParts.length - 1]

      // Delete from storage
      const { error: deleteError } = await supabase.storage.from("avatars").remove([filePath])

      if (deleteError) {
        throw deleteError
      }

      setAvatarUrl(null)
    } catch (error: any) {
      setError(error.message || t("Error removing avatar"))
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)

    try {
      const { error } = await updateProfile({
        username,
        avatar_url: avatarUrl,
      })

      if (error) {
        throw error
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error: any) {
      setError(error.message || t("Error updating profile"))
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push("/")
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-primary-50">
      <Header />
      <div className="container mx-auto px-4 py-24">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
              <Brain className="h-8 w-8 text-primary-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("Your Profile")}</h1>
            <p className="text-gray-600">{t("Manage your account settings and preferences")}</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-xl border border-white/20 p-8 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <Label htmlFor="avatar">{t("Profile Picture")}</Label>
                <div className="flex items-center space-x-6">
                  <div className="relative h-24 w-24 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl || "/placeholder.svg"}
                        alt={t("Profile picture")}
                        fill
                        className="object-cover"
                        sizes="(max-width: 96px) 100vw, 96px"
                      />
                    ) : (
                      <span className="text-4xl text-gray-400">{username.charAt(0).toUpperCase()}</span>
                    )}
                    {uploading && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col space-y-2">
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex items-center bg-transparent"
                        onClick={() => document.getElementById("avatar-upload")?.click()}
                        disabled={uploading}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {t("Upload")}
                      </Button>
                      {avatarUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex items-center text-red-600 border-red-200 hover:bg-red-50 bg-transparent"
                          onClick={removeAvatar}
                          disabled={uploading}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t("Remove")}
                        </Button>
                      )}
                    </div>
                    <input id="avatar-upload" type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
                    <p className="text-xs text-gray-500">{t("JPG, PNG or GIF. Max size 2MB.")}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t("Email")}</Label>
                <Input id="email" type="email" value={user?.email || ""} disabled className="bg-gray-50" />
                <p className="text-xs text-gray-500">{t("Email cannot be changed")}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">{t("Username")}</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  maxLength={30}
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button type="submit" disabled={saving}>
                  {saving ? t("Saving...") : t("Save Changes")}
                </Button>
                <Button type="button" variant="outline" className="text-red-600 bg-transparent" onClick={handleSignOut}>
                  {t("Sign Out")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
