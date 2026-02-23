"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type Props = {
  orgId: string
  requestId: string
  stepId: string
  stepName: string
}

export function RequestActions({ orgId, requestId, stepId, stepName }: Props) {
  const router = useRouter()
  const [isApproving, setIsApproving] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectComment, setRejectComment] = useState("")
  const [isRejecting, setIsRejecting] = useState(false)

  async function handleApprove() {
    setIsApproving(true)
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/requests/${requestId}/steps/${stepId}/approve`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      )
      if (!res.ok) {
        const body = await res.json()
        toast.error(body.error ?? "Failed to approve")
        return
      }
      toast.success("Request approved")
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setIsApproving(false)
    }
  }

  async function handleReject() {
    if (!rejectComment.trim()) {
      toast.error("A comment is required when rejecting")
      return
    }
    setIsRejecting(true)
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/requests/${requestId}/steps/${stepId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment: rejectComment }),
        },
      )
      if (!res.ok) {
        const body = await res.json()
        toast.error(body.error ?? "Failed to reject")
        return
      }
      toast.success("Request rejected")
      setShowRejectDialog(false)
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setIsRejecting(false)
    }
  }

  return (
    <>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          Your approval is required — Step: {stepName}
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
          Review the details above, then approve or reject this request.
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={isApproving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isApproving ? "Approving…" : "Approve"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowRejectDialog(true)}
            disabled={isApproving}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400"
          >
            Reject
          </Button>
        </div>
      </div>

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this request?</AlertDialogTitle>
            <AlertDialogDescription>
              Rejecting will immediately end the approval chain. The submitter will be notified.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-comment">
              Reason for rejection <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reject-comment"
              placeholder="Explain why this request is being rejected…"
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRejecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={isRejecting || !rejectComment.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRejecting ? "Rejecting…" : "Confirm rejection"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
