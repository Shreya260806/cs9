/* global __PROJECT_NAME__, __PROJECT_OWNER__ */
import { Home, Mail, MapPin } from 'lucide-react'

function Footer() {
  return (
    <footer className="bg-bg-primary px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1200px] overflow-hidden rounded-[32px] border border-border bg-bg-secondary p-10 shadow-[0_30px_80px_rgba(15,23,42,0.04)]">
        <div className="grid gap-10 lg:grid-cols-3">
          <div>
            <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.24em] text-text-secondary">
              Quick Links
            </p>
            <ul className="space-y-3 text-[14px] text-text-secondary">
              <li>
                <a href="#" className="inline-flex items-center gap-2 transition hover:text-text-primary">
                  <Home className="h-4 w-4" strokeWidth={2} />
                  Home
                </a>
              </li>
              <li>
                <a href="https://www.iitrpr.ac.in/" target="_blank" rel="noreferrer" className="transition hover:text-text-primary">
                  IIT Ropar
                </a>
              </li>
              <li>
                <a href="https://vled.iitrpr.ac.in/" target="_blank" rel="noreferrer" className="transition hover:text-text-primary">
                  VLED Lab
                </a>
              </li>
              <li>
                <a href="https://samagama.in/" target="_blank" rel="noreferrer" className="transition hover:text-text-primary">
                  Samagama
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.24em] text-text-secondary">
              Affiliations
            </p>
            <p className="max-w-xs text-[14px] leading-7 text-text-secondary">
              Developed under the guidance of the Vicharanashala Lab for Education Design (VLED), an educational
              innovation initiative at Indian Institute of Technology Ropar.
            </p>
          </div>

          <div>
            <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.24em] text-text-secondary">
              Contact Us
            </p>
            <div className="mb-4 inline-flex items-center gap-3 text-[14px] text-text-secondary">
              <Mail className="h-4 w-4 text-text-muted" strokeWidth={2} />
              <a href="mailto:vled@iitrpr.ac.in" className="transition hover:text-text-primary lowercase">
                vled@iitrpr.ac.in
              </a>
            </div>
            <div className="inline-flex items-start gap-3 text-[14px] leading-7 text-text-secondary">
              <MapPin className="mt-1 h-4 w-4 text-text-muted" strokeWidth={2} />
              <address className="not-italic">
                Indian Institute of Technology Ropar<br />
                Rupnagar, Punjab – 140001<br />
                India
              </address>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-sm text-text-secondary lg:flex-row lg:items-center lg:justify-between">
          <p>
            &copy; {new Date().getFullYear()}. All Rights Reserved.
          </p>
          <p>
            Powered by Vicharanashala Lab for Education Design (VLED), Indian Institute of Technology Ropar.
          </p>
          <p>
              This software was developed by VINS Interns using Vicharanashala Lab's resources during the internship period.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
