/* Customer accounts are retired (company-profile site); every /me page redirects to /quote. */
export default function MeLayout({ children }: LayoutProps<"/me">) {
  return children;
}
