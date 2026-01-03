"use client"

import React, { useState, useEffect } from "react"
import { Plus, Trash2, Edit2, Save, X, Users, DollarSign, Calendar, TrendingUp, Briefcase } from "lucide-react"
import { StaffingRole } from "@/lib/api"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Tooltip from "@/components/ui/Tooltip"

interface StaffingFormProps {
  planId: string
  initialRoles: StaffingRole[]
  onSave: (role: Omit<StaffingRole, "id" | "plan_id"> & { id?: string }) => Promise<void>
  onDelete: (roleId: string) => Promise<void>
}

// Helper to format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function StaffingForm({ planId, initialRoles, onSave, onDelete }: StaffingFormProps) {
  const [roles, setRoles] = useState<StaffingRole[]>(initialRoles)
  const [isEditing, setIsEditing] = useState(false)
  const [currentRole, setCurrentRole] = useState<Partial<StaffingRole>>({})
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Update local state when initialRoles changes
  useEffect(() => {
    setRoles(initialRoles)
  }, [initialRoles])

  const handleAddNew = () => {
    setCurrentRole({
      role_name: "",
      annual_salary: 50000,
      start_month: 1,
      target_count: 1,
      hiring_plan: "fixed_count",
      hiring_rate: 1,
      annual_increase: 3.0 // Default to 3.0% for the input
    })
    setIsEditing(true)
    setError(null)
  }

  const handleEdit = (role: StaffingRole) => {
    setCurrentRole({ 
      ...role,
      // Convert decimal (0.03) to percentage (3.0) for editing
      annual_increase: (role.annual_increase || 0) * 100 
    })
    setIsEditing(true)
    setError(null)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this role?")) {
      try {
        setIsLoading(true)
        await onDelete(id)
        setRoles(roles.filter(r => r.id !== id))
      } catch (err) {
        console.error("Failed to delete role:", err)
        setError("Failed to delete role. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setCurrentRole({})
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentRole.role_name) {
      setError("Role Name is required")
      return
    }

    try {
      setIsLoading(true)
      const roleData = {
        role_name: currentRole.role_name,
        annual_salary: Number(currentRole.annual_salary) || 0,
        start_month: Number(currentRole.start_month) || 1,
        target_count: Number(currentRole.target_count) || 1,
        hiring_plan: currentRole.hiring_plan || "fixed_count",
        hiring_rate: currentRole.hiring_plan === "monthly_rate" ? (Number(currentRole.hiring_rate) || 1) : undefined,
        // Convert percentage (3.5) back to decimal (0.035) for saving
        annual_increase: (Number(currentRole.annual_increase) || 0) / 100
      }

      await onSave({
        ...roleData,
        id: currentRole.id 
      })

      setIsEditing(false)
      setCurrentRole({})
    } catch (err) {
      console.error("Failed to save role:", err)
      setError("Failed to save role. Please check your inputs.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staffing & Payroll
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              Manage headcount, salaries, and hiring timelines.
            </p>
          </div>
          {!isEditing && (
            <Button onClick={handleAddNew} className="gap-1 flex items-center text-sm">
              <Plus className="h-4 w-4" /> Add Role
            </Button>
          )}
        </div>
      
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded mb-4 border border-red-200">
            <h4 className="font-bold text-sm">Error</h4>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-4 border p-4 rounded-md bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="role_name" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  Role Name <span className="text-red-500">*</span>
                  <Tooltip content="Title of the position (e.g., 'Sales Rep', 'Developer')." />
                </label>
                <input
                  id="role_name"
                  value={currentRole.role_name || ""}
                  onChange={(e) => setCurrentRole({ ...currentRole, role_name: e.target.value })}
                  placeholder="e.g. Sales Representative"
                  className="w-full rounded border-gray-300 border p-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="annual_salary" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  Annual Salary
                  <Tooltip content="Base annual salary per person in this role." />
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    id="annual_salary"
                    type="number"
                    min="0"
                    className="w-full rounded border-gray-300 border p-2 pl-8 text-sm"
                    value={currentRole.annual_salary || ""}
                    onChange={(e) => setCurrentRole({ ...currentRole, annual_salary: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="hiring_plan" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  Hiring Plan
                  <Tooltip content="How employees are added over time." />
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <select
                    id="hiring_plan"
                    className="w-full rounded border-gray-300 border p-2 pl-8 text-sm bg-white"
                    value={currentRole.hiring_plan || "fixed_count"}
                    onChange={(e) => setCurrentRole({ ...currentRole, hiring_plan: e.target.value as any })}
                  >
                    <option value="fixed_count">Fixed Count (All at once)</option>
                    <option value="monthly_rate">Ramp Up (Over time)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="target_count" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  Target Headcount
                  <Tooltip content="Maximum number of people to hire for this role." />
                </label>
                <div className="relative">
                  <Users className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    id="target_count"
                    type="number"
                    min="1"
                    step="1"
                    className="w-full rounded border-gray-300 border p-2 pl-8 text-sm"
                    value={currentRole.target_count || ""}
                    onChange={(e) => setCurrentRole({ ...currentRole, target_count: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              {currentRole.hiring_plan === "monthly_rate" && (
                <div className="space-y-2">
                  <label htmlFor="hiring_rate" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                    Hiring Pace (Months per Hire)
                    <Tooltip content="Hire 1 person every X months. (e.g., 1 = monthly, 3 = quarterly)." />
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      id="hiring_rate"
                      type="number"
                      min="1"
                      step="1"
                      className="w-full rounded border-gray-300 border p-2 pl-8 text-sm"
                      value={currentRole.hiring_rate || ""}
                      onChange={(e) => setCurrentRole({ ...currentRole, hiring_rate: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="start_month" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  Start Month
                  <Tooltip content="Month number (1-60) when hiring begins." />
                </label>
                <div className="relative">
                  <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    id="start_month"
                    type="number"
                    min="1"
                    max="60"
                    className="w-full rounded border-gray-300 border p-2 pl-8 text-sm"
                    value={currentRole.start_month || ""}
                    onChange={(e) => setCurrentRole({ ...currentRole, start_month: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="annual_increase" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  Annual Increase (%)
                  <Tooltip content="Expected annual salary increase (e.g., 3.5 for 3.5%)." />
                </label>
                <div className="relative">
                  <TrendingUp className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    id="annual_increase"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="w-full rounded border-gray-300 border p-2 pl-8 text-sm"
                    value={currentRole.annual_increase || ""}
                    onChange={(e) => setCurrentRole({ ...currentRole, annual_increase: parseFloat(e.target.value) })}
                  />
                </div>
                <p className="text-xs text-gray-500 text-right">
                  Enters as: {currentRole.annual_increase}%
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={handleCancel} disabled={isLoading} className="flex items-center">
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="flex items-center">
                <Save className="h-4 w-4 mr-1" /> {currentRole.id ? "Update Role" : "Add Role"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Role Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Salary (Annual)</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Plan</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Target</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Start</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {roles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">
                      No staffing roles defined yet. Click "Add Role" to begin.
                    </td>
                  </tr>
                ) : (
                  roles.map((role) => (
                    <tr key={role.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{role.role_name}</td>
                      <td className="px-4 py-3">{formatCurrency(role.annual_salary)}</td>
                      <td className="px-4 py-3">
                        {role.hiring_plan === "monthly_rate" 
                          ? `Ramp (1/${role.hiring_rate || 1}mo)` 
                          : "Fixed"}
                      </td>
                      <td className="px-4 py-3">{role.target_count}</td>
                      <td className="px-4 py-3">Month {role.start_month}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(role)}
                            className="p-1 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(role.id)}
                            className="p-1 text-red-600 hover:text-red-800 rounded hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
    </Card>
  )
}
