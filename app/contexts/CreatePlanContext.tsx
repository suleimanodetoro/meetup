// app/contexts/CreatePlanContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';

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
  interests: string[];
  costs: CostItem[];
  guidelinesAccepted: boolean;
}

interface CreatePlanContextType {
  formData: PlanFormData;
  currentStep: number;
  totalSteps: number;
  updateField: <K extends keyof PlanFormData>(field: K, value: PlanFormData[K]) => void;
  nextStep: () => void;
  prevStep: () => void;
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
  interests: [],
  costs: [],
  guidelinesAccepted: false,
};

const CreatePlanContext = createContext<CreatePlanContextType | undefined>(undefined);

export function CreatePlanProvider({ children }: { children: ReactNode }) {
  const [formData, setFormData] = useState<PlanFormData>(initialFormData);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 9; // Including review

  const updateField = <K extends keyof PlanFormData>(field: K, value: PlanFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const canContinue = (): boolean => {
    switch (currentStep) {
      case 1: // Plan Name
        return formData.title.trim().length > 0 && formData.title.length <= 60;
      case 2: // Plan Image
        return true; // Optional
      case 3: // About Activity
        return formData.description.trim().length >= 30;
      case 4: // Date
        return formData.isOneDay || (formData.endDate !== undefined && formData.endDate >= formData.startDate);
      case 5: // Destinations
        return formData.venues.length > 0 && formData.venues.length <= 3;
      case 6: // Interests
        return formData.interests.length > 0 && formData.interests.length <= 5;
      case 7: // Costs
        return formData.costs.length > 0 || formData.costs.some(c => c.name === 'No expected cost');
      case 8: // Guidelines
        return formData.guidelinesAccepted;
      default:
        return true;
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setCurrentStep(1);
  };

  return (
    <CreatePlanContext.Provider
      value={{
        formData,
        currentStep,
        totalSteps,
        updateField,
        nextStep,
        prevStep,
        canContinue,
        resetForm,
      }}
    >
      {children}
    </CreatePlanContext.Provider>
  );
}

export const useCreatePlan = () => {
  const context = useContext(CreatePlanContext);
  if (!context) {
    throw new Error('useCreatePlan must be used within CreatePlanProvider');
  }
  return context;
};

// Export types for use in other files
export type { VenueData, CostItem, PlanFormData };