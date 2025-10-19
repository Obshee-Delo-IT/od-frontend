'use client';

import Image from 'next/image';
import { useState, ReactElement, cloneElement, isValidElement, ReactNode } from 'react';
import { Modal } from '@/shared/ui/components/Modal';
import css from './ImagePreview.module.css';

interface ImagePreviewClientProps {
  children: ReactNode;
}

interface ImgElementProps {
  src?: string;
  className?: string;
}

export const ImagePreviewClient = ({ children }: ImagePreviewClientProps) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleImageClick = (src: string) => {
    setSelectedImage(src);
  };

  const handleClose = () => {
    setSelectedImage(null);
  };

  const addClickHandlers = (element: ReactElement): ReactElement => {
    const props = element.props as ImgElementProps & { children?: ReactNode };

    if (element.type === 'img' && props.src) {
      return cloneElement(element, {
        onClick: () => handleImageClick(props.src as string),
        className: `${props.className || ''} ${css.clickableImage}`,
        role: 'button',
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleImageClick(props.src as string);
          }
        },
      } as Record<string, unknown>);
    }

    if (props.children) {
      const processedChildren = Array.isArray(props.children)
        ? (props.children.map((child: unknown) =>
            isValidElement(child) ? addClickHandlers(child) : child
          ) as ReactNode)
        : isValidElement(props.children)
          ? addClickHandlers(props.children)
          : props.children;

      return cloneElement(
        element,
        {
          key: element.key,
        },
        processedChildren
      );
    }

    return element;
  };

  const processedChildren = Array.isArray(children)
    ? children.map((child: unknown) => (isValidElement(child) ? addClickHandlers(child) : child))
    : isValidElement(children)
      ? addClickHandlers(children)
      : children;

  return (
    <>
      {processedChildren}
      <Modal isOpen={!!selectedImage} onClose={handleClose}>
        {selectedImage && (
          <div className={css.imageWrapper}>
            <Image src={selectedImage} alt="" fill style={{ objectFit: 'contain' }} quality={80} />
          </div>
        )}
      </Modal>
    </>
  );
};
