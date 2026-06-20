// app/contexts/CreatePlanContext.tsx
import React, { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';

// Define interfaces 
interface VenueData {
  name: string;
  address?: string;
  city?: string;
  country?: string;
  country_code?: string;
  lat?: number;
  lng?: number;
}

interface DestinationData {
  city: string;
  country: string;
  country_code?: string;
}

interface CostItem {
  name: string;
  amount?: number;
  isOptional: boolean;
  link?: string;
}

interface PlanFormData {
  title: string;
  imageUri?: string;
  imageBase64?: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  isOneDay: boolean;
  isAllDay: boolean;
  venues: VenueData[];
  destinations: DestinationData[];
  interests: string[];
  costs: CostItem[];
  guidelines?: string;
  guidelinesAccepted: boolean;
  maxAttendees?: number;
}

interface CreatePlanContextType {
  formData: PlanFormData;
  currentStep: number;
  totalSteps: number;
  updateField: <K extends keyof PlanFormData>(field: K, value: PlanFormData[K]) => void;
  nextStep: () => void;
  prevStep: () => void;
  setStep: (step: number) => void; // NEW: explicitly set step
  canContinue: () => boolean;
  resetForm: () => void;
}

const initialFormData: PlanFormData = {
  title: '',
  description: '',
  startDate: new Date(),
  isOneDay: false,
  isAllDay: false,
  venues: [],
  destinations: [],
  interests: [],
  costs: [],
  guidelines: '',
  guidelinesAccepted: false,
  maxAttendees: 10,
};

const CreatePlanContext = createContext<CreatePlanContextType | undefined>(undefined);

const TOTAL_STEPS = 9; // Including review

export function CreatePlanProvider({ children }: { children: ReactNode }) {
  const [formData, setFormData] = useState<PlanFormData>(initialFormData);
  const [currentStep, setCurrentStep] = useState(1);

  // Stable identity (useCallback + functional updates). Crucial: every consumer
  // screen runs `useEffect(() => updateField(...))` / `setStep(N)` keyed on these
  // fns, and the provider sits at the app root with many create-plan screens
  // mounted at once. If these changed every render, those effects would re-fire
  // forever ("Maximum update depth exceeded"). Bail when the value is unchanged
  // so a mount-time `updateField('title', formData.title)` doesn't churn state.
  const updateField = useCallback(
    <K extends keyof PlanFormData>(field: K, value: PlanFormData[K]) => {
      setFormData((prev) => (Object.is(prev[field], value) ? prev : { ...prev, [field]: value }));
    },
    [],
  );

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => (prev < TOTAL_STEPS ? prev + 1 : prev));
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => (prev > 1 ? prev - 1 : prev));
  }, []);

  // Explicitly set the current step (no-op if unchanged so it never loops).
  const setStep = useCallback((step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS) {
      setCurrentStep((prev) => (prev === step ? prev : step));
    }
  }, []);

  const canContinue = useCallback((): boolean => {
    switch (currentStep) {
      case 1: // Plan Name
        return formData.title.trim().length > 0 && formData.title.length <= 60;
      case 2: // Plan Image (required)
        return !!formData.imageUri || !!formData.imageBase64;
      case 3: // About Activity
        return formData.description.trim().length >= 30;
      case 4: // Date
        return formData.isOneDay || (formData.endDate !== undefined && formData.endDate >= formData.startDate);
      case 5: // Destinations
        return (formData.venues && formData.venues.length > 0 && formData.venues.length <= 3) ||
               (formData.destinations && formData.destinations.length > 0);
      case 6: // Interests
        return formData.interests && formData.interests.length > 0 && formData.interests.length <= 5;
      case 7: // Costs
        return formData.costs && (formData.costs.length > 0 || formData.costs.some(c => c.name === 'No expected cost'));
      case 8: // Guidelines
        return formData.guidelinesAccepted;
      default:
        return true;
    }
  }, [formData, currentStep]);

  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setCurrentStep(1);
  }, []);

  const value = useMemo<CreatePlanContextType>(
    () => ({
      formData,
      currentStep,
      totalSteps: TOTAL_STEPS,
      updateField,
      nextStep,
      prevStep,
      setStep,
      canContinue,
      resetForm,
    }),
    [formData, currentStep, updateField, nextStep, prevStep, setStep, canContinue, resetForm],
  );

  return <CreatePlanContext.Provider value={value}>{children}</CreatePlanContext.Provider>;
}

export const useCreatePlan = () => {
  const context = useContext(CreatePlanContext);
  if (!context) {
    throw new Error('useCreatePlan must be used within CreatePlanProvider');
  }
  return context;
};

// Export types for use in other files
export type { VenueData, DestinationData, CostItem, PlanFormData };