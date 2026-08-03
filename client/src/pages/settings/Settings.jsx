import React, { useEffect, useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { Settings2, Save, CreditCard, Users, Check, UserPlus, Edit2, Trash2, Shield, Upload, Key } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency } from '../../utils/formatters'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Badge from '../../components/ui/Badge'

const RESOURCE_LABELS = {
  users: 'Team Members',
  products: 'Products',
  customers: 'Customers',
  suppliers: 'Suppliers',
  invoicesPerMonth: 'Invoices / Month',
}

export default function Settings() {
  const { company, user, updateCompany } = useAuth()
  const [tab, setTab] = useState('profile') // 'profile' | 'billing' | 'team' | 'roles' | 'security'
  const isAdmin = user?.role_slug === 'owner' || user?.role_slug === 'admin'

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="page-title-area">
          <h1>Workspace Settings</h1>
          <p>Manage company details, plan & billing, and your team</p>
        </div>
      </div>

      <div className="card max-w-5xl">
        <div className="filter-bar">
          <div className="tab-list">
            <button className={`tab-btn ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>
              Company Profile
            </button>
            <button className={`tab-btn ${tab === 'billing' ? 'active' : ''}`} onClick={() => setTab('billing')}>
              Plan & Billing
            </button>
            {isAdmin && (
              <button className={`tab-btn ${tab === 'team' ? 'active' : ''}`} onClick={() => setTab('team')}>
                Team
              </button>
            )}
            {isAdmin && (
              <button className={`tab-btn ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}>
                Roles & Permissions
              </button>
            )}
            <button className={`tab-btn ${tab === 'security' ? 'active' : ''}`} onClick={() => setTab('security')}>
              Security (2FA)
            </button>
          </div>
        </div>

        {tab === 'profile'  && <CompanyProfileTab company={company} updateCompany={updateCompany} />}
        {tab === 'billing'  && <PlanBillingTab company={company} />}
        {tab === 'team'     && isAdmin && <TeamTab />}
        {tab === 'roles'    && isAdmin && <RolesTab />}
        {tab === 'security' && <SecurityTab />}
      </div>
    </div>
  )
}

function CompanyProfileTab({ company, updateCompany }) {
  const [saving, setSaving]         = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [logoPreview, setLogoPreview] = useState(null)
  const fileRef = useRef(null)
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  useEffect(() => {
    if (company) {
      reset({
        name: company.name || '',
        email: company.email || '',
        phone: company.phone || '',
        website: company.website || '',
        address: company.address || '',
        city: company.city || '',
        state: company.state || '',
        country: company.country || 'India',
        postal_code: company.postal_code || '',
        gst_number: company.gst_number || '',
        pan_number: company.pan_number || '',
        vat_number: company.vat_number || '',
        currency_code: company.currency_code || 'INR',
        invoice_prefix: company.invoice_prefix || 'INV',
      })
      setLogoPreview(company.logo || null)
    }
  }, [company])

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      const res = await api.put('/api/v1/company/me', data)
      updateCompany(res.data.data)
      toast.success('Workspace settings saved successfully!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update workspace settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setLogoPreview(URL.createObjectURL(file))
    const formData = new FormData()
    formData.append('logo', file)
    setUploading(true)
    try {
      const res = await api.post('/api/v1/company/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      updateCompany(res.data.data.company)
      toast.success('Company logo updated!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Logo upload failed.')
      setLogoPreview(company.logo || null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="card-body">
      {/* Logo Upload */}
      <div className="flex items-center gap-5 mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
        <div
          className="h-20 w-20 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-800 cursor-pointer hover:border-indigo-500 transition"
          onClick={() => fileRef.current?.click()}
        >
          {logoPreview
            ? <img src={logoPreview} alt="logo" className="h-full w-full object-contain" />
            : <Upload className="h-6 w-6 text-slate-400" />}
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Company Logo</div>
          <div className="text-xs text-slate-500 mt-0.5 mb-2">PNG, JPG, SVG or WebP · Max 2 MB</div>
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} isLoading={uploading}>
            {uploading ? 'Uploading...' : 'Upload Logo'}
          </Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Legal Company Name"
            placeholder="Acme Enterprise Pvt Ltd"
            required
            error={errors.name?.message}
            {...register('name', { required: 'Name is required' })}
          />
          <Input
            label="Contact Email"
            placeholder="billing@acme.com"
            type="email"
            required
            error={errors.email?.message}
            {...register('email', { required: 'Email is required' })}
          />
          <Input label="Phone Number" placeholder="+91 9876543210" {...register('phone')} />
          <Input label="Website URL" placeholder="https://acme.com" {...register('website')} />
          <Input label="GSTIN Identification No" placeholder="29AAAAA0000A1Z5" {...register('gst_number')} />
          <Input label="PAN Card Number" placeholder="ABCDE1234F" {...register('pan_number')} />
          <Input label="VAT Tax Number" placeholder="VAT-987654" {...register('vat_number')} />
          <Input label="Default Invoice Prefix" placeholder="INV" {...register('invoice_prefix')} />
        </div>

        <div className="divider" />
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Registered Address</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group md:col-span-2">
            <label className="form-label">Office Address</label>
            <input type="text" className="input-field" placeholder="Suite 400, Innovation Block" {...register('address')} />
          </div>
          <Input label="City" placeholder="Bengaluru" {...register('city')} />
          <Input label="State" placeholder="Karnataka" {...register('state')} />
          <Input label="Postal Code (ZIP)" placeholder="560001" {...register('postal_code')} />
          <div className="form-group">
            <label className="form-label">Base Currency</label>
            <select className="input-field" {...register('currency_code')}>
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button type="submit" isLoading={saving} icon={Save}>
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  )
}

function PlanBillingTab({ company }) {
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [changing, setChanging] = useState(false)
  const [confirmPlan, setConfirmPlan] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/v1/subscriptions/me')
      setOverview(res.data.data)
    } catch (err) {
      toast.error('Failed to load subscription details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleChangePlan = async () => {
    if (!confirmPlan) return
    setChanging(true)
    try {
      await api.post('/api/v1/subscriptions/change-plan', { plan: confirmPlan })
      toast.success(`Plan changed to ${confirmPlan} successfully.`)
      setConfirmPlan(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change plan.')
    } finally {
      setChanging(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center"><div className="spinner mx-auto" /></div>
  }
  if (!overview) return null

  const { subscription, limits, usage, plans } = overview

  return (
    <div className="card-body space-y-6">
      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Plan</div>
            <div className="text-lg font-black text-slate-800 dark:text-slate-100 capitalize">{subscription.plan}</div>
          </div>
          <Badge status={subscription.status} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {Object.entries(usage).map(([resource, count]) => {
            const limit = limits[resource]
            const pct = limit ? Math.min(100, Math.round((count / limit) * 100)) : 0
            return (
              <div key={resource} className="text-xs">
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">{RESOURCE_LABELS[resource] || resource}</span>
                  <span className="text-slate-400">{count} / {limit ?? '∞'}</span>
                </div>
                {limit && (
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((p) => (
          <div
            key={p.key}
            className={`rounded-xl border p-4 ${subscription.plan === p.key ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200 dark:border-slate-700'}`}
          >
            <div className="text-sm font-black text-slate-800 dark:text-slate-100 capitalize mb-1">{p.key}</div>
            <ul className="space-y-1 text-[11px] text-slate-500 mt-3 mb-4">
              <li>{p.users ?? 'Unlimited'} team members</li>
              <li>{p.products ?? 'Unlimited'} products</li>
              <li>{p.customers ?? 'Unlimited'} customers</li>
              <li>{p.invoicesPerMonth ?? 'Unlimited'} invoices / month</li>
            </ul>
            {subscription.plan === p.key ? (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
                <Check className="h-3.5 w-3.5" /> Current Plan
              </div>
            ) : (
              <Button variant="secondary" size="sm" className="w-full" onClick={() => setConfirmPlan(p.key)}>
                Switch to {p.key}
              </Button>
            )}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-slate-400">
        This is a simulated billing screen — plan changes take effect immediately with no real payment processed.
      </p>

      <ConfirmDialog
        isOpen={Boolean(confirmPlan)}
        onClose={() => setConfirmPlan(null)}
        onConfirm={handleChangePlan}
        title={`Switch to ${confirmPlan} plan`}
        message={`Are you sure you want to change your plan to ${confirmPlan}? This takes effect immediately.`}
        confirmText="Yes, switch plan"
        isLoading={changing}
      />
    </div>
  )
}

function TeamTab() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const load = async () => {
    setLoading(true)
    try {
      const [uRes, rRes] = await Promise.all([
        api.get('/api/v1/users'),
        api.get('/api/v1/users/roles'),
      ])
      setUsers(uRes.data.data || [])
      setRoles((rRes.data.data || []).filter(r => r.slug !== 'owner'))
    } catch (err) {
      toast.error('Failed to load team members.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openInviteModal = () => {
    setEditingUser(null)
    reset({ name: '', email: '', role_id: '', phone: '' })
    setInviteOpen(true)
  }

  const openEditModal = (u) => {
    setEditingUser(u)
    reset({ role_id: u.role_id })
    setInviteOpen(true)
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      if (editingUser) {
        await api.put(`/api/v1/users/${editingUser.id}`, { role_id: Number(data.role_id) })
        toast.success('Team member updated successfully.')
      } else {
        const res = await api.post('/api/v1/users', { ...data, role_id: Number(data.role_id) })
        toast.success(res.data.message || 'Invitation sent successfully.')
      }
      setInviteOpen(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save team member.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (u) => {
    try {
      await api.put(`/api/v1/users/${u.id}`, { is_active: !u.is_active })
      toast.success(u.is_active ? 'User deactivated.' : 'User reactivated.')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user status.')
    }
  }

  const handleRemove = async () => {
    setSaving(true)
    try {
      await api.delete(`/api/v1/users/${removeTarget.id}`)
      toast.success('Team member removed.')
      setRemoveTarget(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove team member.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card-body">
      <div className="flex justify-end mb-4">
        <Button variant="primary" size="sm" icon={UserPlus} onClick={openInviteModal}>
          Invite Team Member
        </Button>
      </div>

      {loading ? (
        <div className="p-8 text-center"><div className="spinner mx-auto" /></div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-semibold text-slate-900 dark:text-slate-100">
                    {u.name} {u.id === currentUser?.id && <span className="text-[10px] text-slate-400 font-normal">(You)</span>}
                  </td>
                  <td className="text-xs text-slate-500">{u.email}</td>
                  <td><Badge variant="slate">{u.role_name || 'No Role'}</Badge></td>
                  <td>
                    <Badge variant={u.is_active ? 'success' : 'slate'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {u.role_slug !== 'owner' && (
                        <>
                          <button onClick={() => openEditModal(u)} className="btn-icon-only" title="Change Role">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {u.id !== currentUser?.id && (
                            <button onClick={() => toggleActive(u)} className="btn-icon-only text-amber-500" title={u.is_active ? 'Deactivate' : 'Reactivate'}>
                              <Users className="h-4 w-4" />
                            </button>
                          )}
                          {u.id !== currentUser?.id && (
                            <button onClick={() => setRemoveTarget(u)} className="btn-icon-only text-rose-500" title="Remove">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={editingUser ? `Change Role — ${editingUser.name}` : 'Invite Team Member'}
        size="sm"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!editingUser && (
            <>
              <Input
                label="Full Name"
                required
                error={errors.name?.message}
                {...register('name', { required: 'Name is required' })}
              />
              <Input
                label="Email Address"
                type="email"
                required
                error={errors.email?.message}
                {...register('email', { required: 'Email is required' })}
              />
              <Input label="Phone Number (Optional)" {...register('phone')} />
            </>
          )}

          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="input-field" required {...register('role_id', { required: 'Role is required' })}>
              <option value="">Select Role</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {errors.role_id && <p className="form-error">{errors.role_id.message}</p>}
          </div>

          {!editingUser && (
            <p className="text-[10px] text-slate-400">
              A temporary password will be emailed to this person to log in for the first time.
            </p>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={() => setInviteOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              {editingUser ? 'Save Role' : 'Send Invite'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        title="Remove Team Member"
        message={`Are you sure you want to remove ${removeTarget?.name}? They will lose access immediately.`}
        confirmText="Yes, remove"
        isLoading={saving}
      />
    </div>
  )
}

// ── Roles & Permissions Tab ────────────────────────────────────
function RolesTab() {
  const [roles, setRoles]         = useState([])
  const [allPerms, setAllPerms]   = useState([])
  const [rolePerms, setRolePerms] = useState({}) // { roleId: Set<permId> }
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [rRes, pRes] = await Promise.all([
          api.get('/api/v1/roles'),
          api.get('/api/v1/roles/permissions'),
        ])
        const rolesData = rRes.data.data || []
        const permsData = pRes.data.data || []
        setRoles(rolesData)
        setAllPerms(permsData)

        const rpMap = {}
        await Promise.all(
          rolesData.filter(r => r.slug !== 'owner').map(async (role) => {
            const res = await api.get(`/api/v1/roles/${role.id}/permissions`)
            rpMap[role.id] = new Set((res.data.data || []).map(p => p.id))
          })
        )
        setRolePerms(rpMap)
      } catch { toast.error('Failed to load roles & permissions.') }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const togglePerm = (roleId, permId) => {
    setRolePerms(prev => {
      const s = new Set(prev[roleId] || [])
      s.has(permId) ? s.delete(permId) : s.add(permId)
      return { ...prev, [roleId]: s }
    })
  }

  const saveRole = async (roleId) => {
    setSaving(roleId)
    try {
      await api.put(`/api/v1/roles/${roleId}/permissions`, {
        permission_ids: [...(rolePerms[roleId] || [])],
      })
      toast.success('Permissions saved!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save permissions.')
    } finally { setSaving(null) }
  }

  if (loading) return <div className="p-8 text-center"><div className="spinner mx-auto" /></div>

  const groups = allPerms.reduce((acc, p) => {
    if (!acc[p.resource]) acc[p.resource] = []
    acc[p.resource].push(p)
    return acc
  }, {})

  const editableRoles = roles.filter(r => r.slug !== 'owner')

  return (
    <div className="card-body">
      <p className="text-xs text-slate-500 mb-4">
        Toggle permissions per role. <strong>Owner</strong> always has full access and cannot be modified.
      </p>
      <div className="overflow-x-auto">
        <table className="data-table text-xs">
          <thead>
            <tr>
              <th className="text-left">Permission</th>
              {editableRoles.map(r => (
                <th key={r.id} className="text-center capitalize">{r.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groups).map(([resource, perms]) => (
              <React.Fragment key={`group-${resource}`}>
                <tr>
                  <td colSpan={editableRoles.length + 1} className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-500 uppercase text-[10px] tracking-widest py-2 px-3">
                    {resource}
                  </td>
                </tr>
                {perms.map(perm => (
                  <tr key={perm.id}>
                    <td className="text-slate-600 dark:text-slate-300">{perm.action}</td>
                    {editableRoles.map(role => (
                      <td key={role.id} className="text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                          checked={rolePerms[role.id]?.has(perm.id) || false}
                          onChange={() => togglePerm(role.id, perm.id)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2 mt-6">
        {editableRoles.map(role => (
          <Button
            key={role.id}
            size="sm"
            variant="primary"
            isLoading={saving === role.id}
            onClick={() => saveRole(role.id)}
          >
            Save {role.name}
          </Button>
        ))}
      </div>
    </div>
  )
}

// ── Security / 2FA Tab ─────────────────────────────────────────
function SecurityTab() {
  const [qrData, setQrData]     = useState(null)
  const [code, setCode]         = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy]         = useState(false)
  const [enabled, setEnabled]   = useState(false)
  const { user }                = useAuth()

  useEffect(() => {
    setEnabled(Boolean(user?.totp_enabled))
  }, [user])

  const startEnroll = async () => {
    setBusy(true)
    try {
      const res = await api.post('/api/v1/auth/2fa/enroll')
      setQrData(res.data.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start 2FA enrollment.')
    } finally { setBusy(false) }
  }

  const verifyEnroll = async () => {
    if (!code.trim()) return toast.error('Enter the 6-digit code from your authenticator.')
    setBusy(true)
    try {
      await api.post('/api/v1/auth/2fa/enroll/verify', { code })
      toast.success('Two-Factor Authentication enabled!')
      setQrData(null)
      setCode('')
      setEnabled(true)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid code.')
    } finally { setBusy(false) }
  }

  const disable2FA = async () => {
    if (!password.trim()) return toast.error('Enter your password to disable 2FA.')
    setBusy(true)
    try {
      await api.delete('/api/v1/auth/2fa', { data: { password } })
      toast.success('Two-Factor Authentication disabled.')
      setPassword('')
      setEnabled(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to disable 2FA.')
    } finally { setBusy(false) }
  }

  return (
    <div className="card-body max-w-lg">
      <div className="flex items-center gap-3 mb-5">
        <Shield className="h-6 w-6 text-indigo-500" />
        <div>
          <div className="text-sm font-bold text-slate-800 dark:text-slate-100">Two-Factor Authentication</div>
          <div className="text-xs text-slate-500">Add an extra layer of security to your account.</div>
        </div>
        <Badge variant={enabled ? 'success' : 'slate'} className="ml-auto">
          {enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      </div>

      {!enabled && !qrData && (
        <>
          <p className="text-xs text-slate-500 mb-4">
            Use Google Authenticator, Authy, or any TOTP app to scan a QR code and secure your account.
          </p>
          <Button onClick={startEnroll} isLoading={busy} icon={Key}>Set Up 2FA</Button>
        </>
      )}

      {qrData && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Scan with your authenticator app, then enter the 6-digit code below.</p>
          <div className="flex justify-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData.otpauthUrl)}`}
              alt="2FA QR Code"
              className="rounded-xl border border-slate-200 dark:border-slate-700 p-2 bg-white"
            />
          </div>
          <div className="text-[10px] text-slate-400 text-center break-all">
            Manual key: <strong>{qrData.secret}</strong>
          </div>
          <input
            type="text" value={code} onChange={e => setCode(e.target.value)}
            placeholder="6-digit code" maxLength={6}
            className="input-field text-center tracking-[0.4em] font-mono text-lg"
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setQrData(null)} disabled={busy}>Cancel</Button>
            <Button onClick={verifyEnroll} isLoading={busy} className="flex-1">Verify &amp; Enable</Button>
          </div>
        </div>
      )}

      {enabled && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">2FA is active. Enter your password to disable it.</p>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Current password" className="input-field"
          />
          <Button variant="danger" onClick={disable2FA} isLoading={busy}>Disable 2FA</Button>
        </div>
      )}
    </div>
  )
}
