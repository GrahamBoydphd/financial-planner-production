import { useState, useEffect } from 'react';
import { api, FinancialPlan } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { EconophysicsInputs } from '@/components/forms/shared/EconophysicsInputs';

interface SuccessTaxFormProps {
  plan: FinancialPlan;
  onSuccess: () => void;
}

export default function SuccessTaxForm({ plan, onSuccess }: SuccessTaxFormProps) {
  const [active, setActive] = useState(true);
  const [threshold, setThreshold] = useState('100,000,000');
  const [fraction, setFraction] = useState('5'); // Display as 0-100
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (plan) {
      // Default to true if undefined/null, otherwise respect the value
      setActive(plan.soft_limit_active ?? true);
      
      // Format threshold with commas
      const rawThreshold = plan.soft_limit_threshold || '100000000';
      setThreshold(Number(rawThreshold).toLocaleString());
      
      // Convert fraction 0.0-1.0 to 0-100 for display
      const rawFraction = parseFloat(plan.soft_limit_fraction || '0');
      setFraction((rawFraction * 100).toString());
    }
  }, [plan]);

  const handleActiveChange = (newValue: boolean) => {
    if (!newValue) {
      if (window.confirm("Disabling this leads to physically unrealistic behaviours")) {
        setActive(false);
      }
    } else {
      setActive(true);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Remove commas for API
      const cleanThreshold = threshold.replace(/,/g, '');
      // Convert 0-100 back to 0.0-1.0 for API
      const cleanFraction = (parseFloat(fraction) / 100).toString();

      await api.updatePlan(plan.id, {
        soft_limit_active: active,
        soft_limit_threshold: cleanThreshold,
        soft_limit_fraction: cleanFraction
      });
      onSuccess();
      alert('Friction settings saved.');
    } catch (err) {
      console.error(err);
      alert('Failed to save settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <EconophysicsInputs
        active={active}
        threshold={threshold}
        fraction={fraction}
        currencyCode={plan.currency_code}
        onChangeActive={handleActiveChange}
        onChangeThreshold={setThreshold}
        onChangeFraction={setFraction}
      />

      <div className="mt-4 flex justify-end">
        <Button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </Card>
  );
}
