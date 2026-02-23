"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createOrgSchema } from "@/lib/validations"

type Values = z.infer<typeof createOrgSchema>

export default function NewOrgPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(createOrgSchema),
  })

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const slug = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    setValue("slug", slug)
  }

  async function onSubmit(data: Values) {
    setIsLoading(true)
    try {
      const res = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const body = await res.json()
        toast.error(body.error ?? "Failed to create organization")
        return
      }

      const org = await res.json()
      toast.success(`${org.name} created!`)
      router.push(`/orgs/${org.id}/workflows`)
    } catch {
      toast.error("Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Create organization</h1>
        <p className="mt-1 text-sm text-zinc-500">
          An organization is the workspace for your team&apos;s workflows.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization details</CardTitle>
          <CardDescription>
            Choose a name and a unique URL slug for your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Acme Corp"
                {...register("name", { onChange: handleNameChange })}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slug">URL slug</Label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-zinc-400">approvalkit.app/</span>
                <Input id="slug" placeholder="acme-corp" {...register("slug")} />
              </div>
              {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating…" : "Create organization"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
