import { getCompanyInitial, getInitialAvatarTone } from '../../utils/companies'

export default function CompanyAvatar({ company, size = 40 }) {
  if (company.logoUrl) {
    return (
      <img
        src={company.logoUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-lg object-cover"
        style={{ width: size, height: size }}
        onError={(event) => { event.currentTarget.style.display = 'none' }}
      />
    )
  }

  return (
    <div
      className={`grid shrink-0 place-items-center rounded-lg font-display font-bold ${getInitialAvatarTone(company.name)}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {getCompanyInitial(company.name)}
    </div>
  )
}
