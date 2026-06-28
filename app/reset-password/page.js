import ResetPasswordClient from './ResetPasswordClient';

export const metadata = {
  title: 'Reset Password',
};

export default function ResetPasswordPage({ searchParams }) {
  const token = typeof searchParams?.token === 'string' ? searchParams.token : '';
  return <ResetPasswordClient token={token} />;
}
