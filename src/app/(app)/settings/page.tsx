'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SettingsNav } from '@/components/layout/settings-nav'

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

const settingsSchema = z.object({
  firmName: z.string().min(1, 'Firm name is required'),
  tradingName: z.string().optional(),
  vatRegistered: z.boolean(),
  vatRegistrationNumber: z.string().optional(),
  trustBankName: z.string().optional(),
  trustBankAccountName: z.string().optional(),
  trustBankAccountNumber: z.string().optional(),
  trustBankBranchCode: z.string().optional(),
  trustBankSwift: z.string().optional(),
  businessBankName: z.string().optional(),
  businessBankAccountName: z.string().optional(),
  businessBankAccountNumber: z.string().optional(),
  businessBankBranchCode: z.string().optional(),
  businessBankSwift: z.string().optional(),
  invoicePrefix: z.string().optional(),
  invoicePaymentInstructions: z.string().optional(),
  billingBlocksEnabled: z.boolean(),
  financialYearStartMonth: z.string(),
  smtpHost: z.string().optional(),
  smtpPort: z.string().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpFromEmail: z.string().optional(),
  smtpFromName: z.string().optional(),
  officeAddressLine1: z.string().optional(),
  officeAddressLine2: z.string().optional(),
  officeCity: z.string().optional(),
  officeProvince: z.string().optional(),
  officePostalCode: z.string().optional(),
  officeTel: z.string().optional(),
  officeEmail: z.string().optional(),
  officeWebsite: z.string().optional(),
})

type SettingsFormData = z.infer<typeof settingsSchema>

const GLASS = {
  background: 'rgba(255,252,250,0.62)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.80)',
  borderRadius: 20,
  padding: 24,
  boxShadow: '0 8px 32px rgba(74,72,69,0.08), 0 2px 8px rgba(74,72,69,0.04)',
}

const INPUT_STYLE = {
  background: 'rgba(241,237,234,0.6)',
  border: '1px solid #D8D3CB',
  borderRadius: 8,
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase' as const, color: '#80796F', marginBottom: 6 }}>
      {children}
    </p>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400, color: '#2C2C2A', marginBottom: 16 }}>
      {children}
    </h2>
  )
}

export default function FirmSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      firmName: '',
      vatRegistered: false,
      billingBlocksEnabled: true,
      financialYearStartMonth: '3',
      smtpPort: '587',
    },
  })

  const vatRegistered = watch('vatRegistered')

  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'admin') {
      toast.error('Access denied. Admin role required.')
      router.push('/dashboard')
      return
    }

    // Load existing settings
    fetch('/api/firm-settings')
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          const primaryOffice = data.offices?.find(
            (o: { isPrimary: boolean }) => o.isPrimary,
          )
          reset({
            firmName: data.firmName ?? '',
            tradingName: data.tradingName ?? '',
            vatRegistered: data.vatRegistered ?? false,
            vatRegistrationNumber: data.vatRegistrationNumber ?? '',
            trustBankName: data.trustBankName ?? '',
            trustBankAccountName: data.trustBankAccountName ?? '',
            trustBankAccountNumber: data.trustBankAccountNumber ?? '',
            trustBankBranchCode: data.trustBankBranchCode ?? '',
            trustBankSwift: data.trustBankSwift ?? '',
            businessBankName: data.businessBankName ?? '',
            businessBankAccountName: data.businessBankAccountName ?? '',
            businessBankAccountNumber: data.businessBankAccountNumber ?? '',
            businessBankBranchCode: data.businessBankBranchCode ?? '',
            businessBankSwift: data.businessBankSwift ?? '',
            invoicePrefix: data.invoicePrefix ?? 'INV',
            invoicePaymentInstructions: data.invoicePaymentInstructions ?? '',
            billingBlocksEnabled: data.billingBlocksEnabled ?? true,
            financialYearStartMonth: String(data.financialYearStartMonth ?? 3),
            smtpHost: data.smtpHost ?? '',
            smtpPort: String(data.smtpPort ?? 587),
            smtpUser: data.smtpUser ?? '',
            smtpPassword: data.smtpPassword ?? '',
            smtpFromEmail: data.smtpFromEmail ?? '',
            smtpFromName: data.smtpFromName ?? '',
            officeAddressLine1: primaryOffice?.addressLine1 ?? '',
            officeAddressLine2: primaryOffice?.addressLine2 ?? '',
            officeCity: primaryOffice?.city ?? '',
            officeProvince: primaryOffice?.province ?? '',
            officePostalCode: primaryOffice?.postalCode ?? '',
            officeTel: primaryOffice?.tel ?? '',
            officeEmail: primaryOffice?.email ?? '',
            officeWebsite: primaryOffice?.website ?? '',
          })
          if (data.logoFilePath) setLogoPreview(data.logoFilePath)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [session, status, router, reset])

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      setLogoPreview(data.filePath)
      toast.success('Logo uploaded successfully')
    } catch {
      toast.error('Failed to upload logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  const onSubmit = async (data: SettingsFormData) => {
    try {
      const res = await fetch('/api/firm-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmName: data.firmName,
          tradingName: data.tradingName || null,
          logoFilePath: logoPreview,
          vatRegistered: data.vatRegistered,
          vatRegistrationNumber: data.vatRegistrationNumber || null,
          trustBankName: data.trustBankName || null,
          trustBankAccountName: data.trustBankAccountName || null,
          trustBankAccountNumber: data.trustBankAccountNumber || null,
          trustBankBranchCode: data.trustBankBranchCode || null,
          trustBankSwift: data.trustBankSwift || null,
          businessBankName: data.businessBankName || null,
          businessBankAccountName: data.businessBankAccountName || null,
          businessBankAccountNumber: data.businessBankAccountNumber || null,
          businessBankBranchCode: data.businessBankBranchCode || null,
          businessBankSwift: data.businessBankSwift || null,
          invoicePrefix: data.invoicePrefix || 'INV',
          invoicePaymentInstructions: data.invoicePaymentInstructions || null,
          billingBlocksEnabled: data.billingBlocksEnabled,
          financialYearStartMonth: parseInt(data.financialYearStartMonth),
          smtpHost: data.smtpHost || null,
          smtpPort: data.smtpPort ? parseInt(data.smtpPort) : 587,
          smtpUser: data.smtpUser || null,
          smtpPassword: data.smtpPassword || null,
          smtpFromEmail: data.smtpFromEmail || null,
          smtpFromName: data.smtpFromName || null,
          office: {
            addressLine1: data.officeAddressLine1 || null,
            addressLine2: data.officeAddressLine2 || null,
            city: data.officeCity || null,
            province: data.officeProvince || null,
            postalCode: data.officePostalCode || null,
            tel: data.officeTel || null,
            email: data.officeEmail || null,
            website: data.officeWebsite || null,
          },
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save settings')
      }

      toast.success('Firm settings saved successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings')
    }
  }

  if (loading) {
    return (
      <div>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', paddingTop: '16px' }}>
      {/* Dark header */}
      <div className="fade-up page-dark-header" style={{ animationDelay: '0ms', background: 'rgba(74,72,69,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '20px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.50)', marginBottom: 4 }}>
            Settings
          </p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: '#F1EDEA', margin: 0, lineHeight: 1.2 }}>
            Firm Settings
          </h1>
        </div>
        <button
          type="submit"
          form="settings-form"
          disabled={isSubmitting}
          style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#ffffff', background: '#B08B82', borderRadius: 40, padding: '10px 28px', border: 'none', cursor: 'pointer' }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#93706A'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#B08B82'}
        >
          {isSubmitting ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      <SettingsNav />

      <form id="settings-form" onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 24 }}>
        {/* Section 1: Firm Identity */}
        <div className="fade-up" style={{ animationDelay: '80ms', ...GLASS }}>
          <SectionHeading>Firm Identity</SectionHeading>
          <div style={{ height: 1, background: '#D8D3CB', margin: '0 0 20px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <FieldLabel>Firm Name <span style={{ color: '#C0574A' }}>*</span></FieldLabel>
              <Input
                {...register('firmName')}
                placeholder="Dolata & Co Attorneys"
                style={INPUT_STYLE}
              />
              {errors.firmName && (
                <p style={{ fontSize: 12, color: '#C0574A', marginTop: 4 }}>{errors.firmName.message}</p>
              )}
            </div>
            <div>
              <FieldLabel>Trading Name</FieldLabel>
              <Input
                {...register('tradingName')}
                placeholder="Dolata & Co"
                style={INPUT_STYLE}
              />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel>Firm Logo</FieldLabel>
            {logoPreview && (
              <div style={{ marginBottom: 8 }}>
                <img
                  src={logoPreview}
                  alt="Firm logo"
                  style={{ height: 64, width: 'auto', objectFit: 'contain', border: '1px solid #D8D3CB', borderRadius: 8, padding: 4 }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            )}
            <Input
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleLogoUpload}
              disabled={uploadingLogo}
              style={{ ...INPUT_STYLE, cursor: 'pointer' }}
            />
            {uploadingLogo && (
              <p style={{ fontSize: 12, color: '#80796F', marginTop: 4 }}>Uploading…</p>
            )}
          </div>
        </div>

        {/* Section 2: Contact & Offices */}
        <div className="fade-up" style={{ animationDelay: '160ms', ...GLASS }}>
          <SectionHeading>Contact &amp; Offices</SectionHeading>
          <div style={{ height: 1, background: '#D8D3CB', margin: '0 0 20px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <FieldLabel>Address Line 1</FieldLabel>
              <Input {...register('officeAddressLine1')} placeholder="123 Main Street" style={INPUT_STYLE} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <FieldLabel>Address Line 2</FieldLabel>
              <Input {...register('officeAddressLine2')} placeholder="Suite 100" style={INPUT_STYLE} />
            </div>
            <div>
              <FieldLabel>City</FieldLabel>
              <Input {...register('officeCity')} placeholder="Cape Town" style={INPUT_STYLE} />
            </div>
            <div>
              <FieldLabel>Province</FieldLabel>
              <Input {...register('officeProvince')} placeholder="Western Cape" style={INPUT_STYLE} />
            </div>
            <div>
              <FieldLabel>Postal Code</FieldLabel>
              <Input {...register('officePostalCode')} placeholder="8001" style={INPUT_STYLE} />
            </div>
            <div>
              <FieldLabel>Telephone</FieldLabel>
              <Input {...register('officeTel')} placeholder="+27 21 000 0000" style={INPUT_STYLE} />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <Input {...register('officeEmail')} type="email" placeholder="info@dcco.law" style={INPUT_STYLE} />
            </div>
            <div>
              <FieldLabel>Website</FieldLabel>
              <Input {...register('officeWebsite')} placeholder="https://dcco.law" style={INPUT_STYLE} />
            </div>
          </div>
        </div>

        {/* Section 3: VAT */}
        <div className="fade-up" style={{ animationDelay: '240ms', ...GLASS }}>
          <SectionHeading>VAT</SectionHeading>
          <div style={{ height: 1, background: '#D8D3CB', margin: '0 0 20px 0' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#2C2C2A' }}>VAT Registered</p>
              <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F', marginTop: 2 }}>
                15% VAT will be applied to all tax invoices
              </p>
            </div>
            <Switch
              checked={vatRegistered}
              onCheckedChange={(val) => setValue('vatRegistered', val)}
            />
          </div>

          {vatRegistered && (
            <div style={{ marginTop: 16 }}>
              <FieldLabel>VAT Registration Number <span style={{ color: '#C0574A' }}>*</span></FieldLabel>
              <Input
                {...register('vatRegistrationNumber')}
                placeholder="4123456789"
                style={INPUT_STYLE}
              />
            </div>
          )}
        </div>

        {/* Section 4: Trust Bank Account */}
        <div className="fade-up" style={{ animationDelay: '320ms', ...GLASS }}>
          <SectionHeading>Trust Bank Account</SectionHeading>
          <div style={{ height: 1, background: '#D8D3CB', margin: '0 0 20px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <FieldLabel>Bank Name</FieldLabel>
              <Input {...register('trustBankName')} placeholder="Nedbank" style={INPUT_STYLE} />
            </div>
            <div>
              <FieldLabel>Account Name</FieldLabel>
              <Input {...register('trustBankAccountName')} placeholder="Dolata & Co Trust Account" style={INPUT_STYLE} />
            </div>
            <div>
              <FieldLabel>Account Number</FieldLabel>
              <Input {...register('trustBankAccountNumber')} placeholder="1234567890" style={INPUT_STYLE} />
            </div>
            <div>
              <FieldLabel>Branch Code</FieldLabel>
              <Input {...register('trustBankBranchCode')} placeholder="198765" style={INPUT_STYLE} />
            </div>
            <div>
              <FieldLabel>SWIFT Code</FieldLabel>
              <Input {...register('trustBankSwift')} placeholder="NEDSZAJJ" style={INPUT_STYLE} />
            </div>
          </div>
        </div>

        {/* Section 5: Business Bank Account */}
        <div className="fade-up" style={{ animationDelay: '400ms', ...GLASS }}>
          <SectionHeading>Business Bank Account</SectionHeading>
          <div style={{ height: 1, background: '#D8D3CB', margin: '0 0 20px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <FieldLabel>Bank Name</FieldLabel>
              <Input {...register('businessBankName')} placeholder="FNB" style={INPUT_STYLE} />
            </div>
            <div>
              <FieldLabel>Account Name</FieldLabel>
              <Input {...register('businessBankAccountName')} placeholder="Dolata & Co Attorneys" style={INPUT_STYLE} />
            </div>
            <div>
              <FieldLabel>Account Number</FieldLabel>
              <Input {...register('businessBankAccountNumber')} placeholder="0987654321" style={INPUT_STYLE} />
            </div>
            <div>
              <FieldLabel>Branch Code</FieldLabel>
              <Input {...register('businessBankBranchCode')} placeholder="250655" style={INPUT_STYLE} />
            </div>
            <div>
              <FieldLabel>SWIFT Code</FieldLabel>
              <Input {...register('businessBankSwift')} placeholder="FIRNZAJJ" style={INPUT_STYLE} />
            </div>
          </div>
        </div>

        {/* Section 6: Invoice Settings */}
        <div className="fade-up" style={{ animationDelay: '480ms', ...GLASS }}>
          <SectionHeading>Invoice Settings</SectionHeading>
          <div style={{ height: 1, background: '#D8D3CB', margin: '0 0 20px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <FieldLabel>Invoice Prefix</FieldLabel>
              <Input {...register('invoicePrefix')} placeholder="INV" style={INPUT_STYLE} />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel>Invoice Payment Instructions</FieldLabel>
            <textarea
              {...register('invoicePaymentInstructions')}
              rows={3}
              placeholder="Payment is due within 30 days of invoice date…"
              style={{ ...INPUT_STYLE, width: '100%', padding: '8px 12px', fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#2C2C2A', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
            <div>
              <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#2C2C2A' }}>6-Minute Billing Blocks</p>
              <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F', marginTop: 2 }}>
                Time entries will be rounded up to the nearest 6-minute increment
              </p>
            </div>
            <Switch
              checked={watch('billingBlocksEnabled')}
              onCheckedChange={(val) => setValue('billingBlocksEnabled', val)}
            />
          </div>
        </div>

        {/* Section 7: Email / SMTP */}
        <div className="fade-up" style={{ animationDelay: '560ms', ...GLASS }}>
          <div style={{ marginBottom: 16 }}>
            <SectionHeading>Email (SMTP)</SectionHeading>
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F', marginTop: -8 }}>
              Configure outgoing mail so invoices can be emailed directly from the system.
            </p>
          </div>
          <div style={{ height: 1, background: '#D8D3CB', margin: '0 0 20px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <FieldLabel>SMTP Host</FieldLabel>
              <Input {...register('smtpHost')} placeholder="smtp.gmail.com" style={INPUT_STYLE} />
            </div>
            <div>
              <FieldLabel>Port</FieldLabel>
              <Input {...register('smtpPort')} type="number" placeholder="587" style={INPUT_STYLE} />
            </div>
            <div>
              <FieldLabel>Username</FieldLabel>
              <Input {...register('smtpUser')} placeholder="invoices@dcco.law" autoComplete="off" style={INPUT_STYLE} />
            </div>
            <div>
              <FieldLabel>Password / App Password</FieldLabel>
              <Input {...register('smtpPassword')} type="password" placeholder="••••••••" autoComplete="off" style={INPUT_STYLE} />
            </div>
            <div>
              <FieldLabel>From Email</FieldLabel>
              <Input {...register('smtpFromEmail')} type="email" placeholder="invoices@dcco.law" style={INPUT_STYLE} />
            </div>
            <div>
              <FieldLabel>From Name</FieldLabel>
              <Input {...register('smtpFromName')} placeholder="Dolata & Co Attorneys" style={INPUT_STYLE} />
            </div>
          </div>
        </div>

        {/* Section 8: Practice Settings */}
        <div className="fade-up" style={{ animationDelay: '640ms', ...GLASS }}>
          <SectionHeading>Practice Settings</SectionHeading>
          <div style={{ height: 1, background: '#D8D3CB', margin: '0 0 20px 0' }} />

          <div>
            <FieldLabel>Financial Year Start Month</FieldLabel>
            <Select
              value={watch('financialYearStartMonth')}
              onValueChange={(val) => val !== null && setValue('financialYearStartMonth', val)}
            >
              <SelectTrigger style={{ width: 192, ...INPUT_STYLE }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Save footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 32 }}>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#ffffff', background: '#B08B82', borderRadius: 40, padding: '10px 28px', border: 'none', cursor: 'pointer' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#93706A'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#B08B82'}
          >
            {isSubmitting ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
