"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { OnboardingFlowField, OnboardingFlowStep } from "@/lib/onboarding-flow";
import { completeOnboarding, saveOnboardingStep } from "./actions";

type Props = {
  flowId: string;
  steps: OnboardingFlowStep[];
  initialData: Record<string, unknown>;
  initialStep: number;
};

export function OnboardingWizard({ flowId, steps, initialData, initialStep }: Props) {
  const router = useRouter();
  const reviewStepIndex = steps.length;
  const [step, setStep] = useState(Math.min(initialStep, Math.max(reviewStepIndex, 0)));
  const [values, setValues] = useState<Record<string, unknown>>({ ...initialData });
  const [pending, startTransition] = useTransition();

  const isReview = step === reviewStepIndex;
  const current = steps[step];
  const isLastField = step === steps.length - 1;
  const totalSteps = steps.length + 1;
  const progress = totalSteps > 0 ? Math.round(((step + 1) / totalSteps) * 100) : 0;

  const missingRequired = useMemo(
    () => (current ? current.fields.filter((f) => f.required && !valueFilled(values[f.key], f.type)) : []),
    [current, values],
  );

  function setField(key: string, value: unknown) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function next() {
    if (!isReview && missingRequired.length > 0) {
      toast.error("Please complete the required fields.");
      return;
    }
    startTransition(async () => {
      if (isReview) {
        const done = await completeOnboarding(flowId, values);
        if (done.error) {
          toast.error(done.error);
          return;
        }
        toast.success("Onboarding complete!");
        router.replace("/portal");
        router.refresh();
        return;
      }
      const nextStep = Math.min(step + 1, reviewStepIndex);
      await saveOnboardingStep(flowId, values, Math.min(nextStep, Math.max(steps.length - 1, 0)));
      setStep(nextStep);
    });
  }

  function back() {
    if (step === 0) return;
    startTransition(async () => {
      const prevStep = step - 1;
      await saveOnboardingStep(flowId, values, Math.min(prevStep, Math.max(steps.length - 1, 0)));
      setStep(prevStep);
    });
  }

  if (steps.length === 0) {
    return (
      <Card className="w-full max-w-2xl">
        <CardContent className="pt-6 text-sm text-muted-foreground">Onboarding isn&apos;t configured yet. Please contact your account manager.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {isReview ? "Review your answers" : `Step ${step + 1} of ${steps.length}`}
          </span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} />
        {isReview ? (
          <>
            <CardTitle>Review your answers</CardTitle>
            <CardDescription>Take a moment to check everything looks right before finishing.</CardDescription>
          </>
        ) : (
          <>
            <CardTitle>{current.title}</CardTitle>
            <CardDescription>{current.description}</CardDescription>
          </>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isReview ? (
          <div className="space-y-5">
            {steps.map((reviewStep) => (
              <div key={reviewStep.title} className="space-y-2">
                <p className="text-sm font-medium">{reviewStep.title}</p>
                <div className="space-y-2 rounded-md border p-3">
                  {reviewStep.fields.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No questions in this step.</p>
                  ) : (
                    reviewStep.fields.map((field) => (
                      <div key={field.key} className="text-sm">
                        <p className="text-xs text-muted-foreground">{field.label}</p>
                        <p className="whitespace-pre-wrap">{formatReviewValue(values[field.key], field.type)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          current.fields.map((field) => (
            <Field key={field.key} field={field} value={values[field.key]} onChange={setField} />
          ))
        )}
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline" onClick={back} disabled={step === 0 || pending}>
          Back
        </Button>
        <Button onClick={next} disabled={pending}>
          {pending ? "Saving…" : isReview ? "Finish" : isLastField ? "Review" : "Continue"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function formatReviewValue(value: unknown, type: OnboardingFlowField["type"]) {
  if (type === "checkbox") return value === true ? "Yes" : "No";
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : "—";
}

function valueFilled(value: unknown, type: OnboardingFlowField["type"]) {
  if (type === "checkbox") return value === true;
  return String(value ?? "").trim().length > 0;
}

function Field({
  field,
  value,
  onChange,
}: {
  field: OnboardingFlowField;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}) {
  const id = `field-${field.key}`;
  const label = (
    <Label htmlFor={id}>
      {field.label}
      {field.required ? <span className="text-red-600"> *</span> : null}
    </Label>
  );

  if (field.type === "textarea") {
    return (
      <div className="space-y-2">
        {label}
        <Textarea
          id={id}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
        {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="space-y-2">
        {label}
        <Select value={String(value ?? "")} onValueChange={(v) => onChange(field.key, v)}>
          <SelectTrigger id={id}>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.type === "checkbox") {
    return (
      <div className="flex items-center gap-2">
        <Checkbox id={id} checked={value === true} onCheckedChange={(c) => onChange(field.key, c === true)} />
        {field.key === "acceptedTerms" ? (
          <Label htmlFor={id}>
            {field.label} I agree to the{" "}
            <Link href="/terms" target="_blank" className="underline underline-offset-4">Terms of Use</Link> and{" "}
            <Link href="/privacy" target="_blank" className="underline underline-offset-4">Privacy Policy</Link>.
            {field.required ? <span className="text-red-600"> *</span> : null}
          </Label>
        ) : label}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label}
      <Input
        id={id}
        type={field.type}
        value={String(value ?? "")}
        placeholder={field.placeholder}
        onChange={(e) => onChange(field.key, e.target.value)}
      />
      {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
    </div>
  );
}
